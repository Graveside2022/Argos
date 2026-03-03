/**
 * Comprehensive safe-alloc preload for APM engine.
 *
 * Approach: Use a dedicated memory pool for ALL allocations made by APM.
 * free() becomes a no-op for pool memory. This eliminates ALL heap corruption
 * from wild pointer frees and double frees at the cost of ~10MB leaked memory
 * per invocation (acceptable for short-lived forked process).
 *
 * We intercept malloc/calloc/realloc/free globally but only use the pool
 * for allocations that come AFTER APM is entered (detected via a flag).
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include <dlfcn.h>
#include <string.h>
#include <stdio.h>
#include <stdint.h>
#include <sys/mman.h>

/* The APM pool — 64MB should be more than enough */
#define POOL_SIZE (64 * 1024 * 1024)
static char *pool_base = NULL;
static size_t pool_pos = 0;
static int pool_active = 0;  /* Set to 1 when APM call starts */

/* Real libc functions */
static void (*real_free)(void *) = NULL;
static void *(*real_malloc)(size_t) = NULL;
static void *(*real_calloc)(size_t, size_t) = NULL;
static void *(*real_realloc)(void *, size_t) = NULL;

/* Bootstrap buffer for early calloc (before dlsym resolves) */
static char bootstrap_buf[65536];
static size_t bootstrap_pos = 0;

static void init_pool(void) {
    if (!pool_base) {
        pool_base = (char *)mmap(NULL, POOL_SIZE, PROT_READ | PROT_WRITE,
                                  MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
        if (pool_base == MAP_FAILED) {
            pool_base = NULL;
        }
    }
}

static void init_real(void) {
    if (!real_free) real_free = dlsym(RTLD_NEXT, "free");
    if (!real_malloc) real_malloc = dlsym(RTLD_NEXT, "malloc");
    if (!real_realloc) real_realloc = dlsym(RTLD_NEXT, "realloc");
}

static int is_pool_ptr(void *ptr) {
    return pool_base &&
           (char *)ptr >= pool_base &&
           (char *)ptr < pool_base + POOL_SIZE;
}

static int is_bootstrap_ptr(void *ptr) {
    return (char *)ptr >= bootstrap_buf &&
           (char *)ptr < bootstrap_buf + sizeof(bootstrap_buf);
}

static void *pool_alloc(size_t size) {
    if (!pool_base) return NULL;
    /* Align to 16 bytes */
    size = (size + 15) & ~(size_t)15;
    if (pool_pos + size > POOL_SIZE) return NULL;
    void *ptr = pool_base + pool_pos;
    pool_pos += size;
    return ptr;
}

void *calloc(size_t n, size_t s) {
    if (!real_calloc) {
        real_calloc = dlsym(RTLD_NEXT, "calloc");
        if (!real_calloc) {
            /* Bootstrap allocation */
            size_t total = n * s;
            if (bootstrap_pos + total <= sizeof(bootstrap_buf)) {
                void *p = bootstrap_buf + bootstrap_pos;
                bootstrap_pos += (total + 15) & ~(size_t)15;
                memset(p, 0, total);
                return p;
            }
            return NULL;
        }
    }

    if (pool_active) {
        init_pool();
        size_t total = n * s;
        void *ptr = pool_alloc(total);
        if (ptr) {
            memset(ptr, 0, total);
            return ptr;
        }
    }

    return real_calloc(n, s);
}

void *malloc(size_t size) {
    init_real();

    if (pool_active) {
        init_pool();
        void *ptr = pool_alloc(size);
        if (ptr) return ptr;
    }

    return real_malloc(size);
}

void free(void *ptr) {
    init_real();
    if (!ptr) return;

    /* Pool allocations: no-op free (memory is reclaimed when pool is unmapped) */
    if (is_pool_ptr(ptr)) return;

    /* Bootstrap allocations: no-op free */
    if (is_bootstrap_ptr(ptr)) return;

    /* Regular allocation: pass through to libc */
    real_free(ptr);
}

void *realloc(void *ptr, size_t size) {
    init_real();

    if (pool_active && ptr == NULL) {
        /* realloc(NULL, size) == malloc(size) */
        init_pool();
        void *new_ptr = pool_alloc(size);
        if (new_ptr) return new_ptr;
    }

    if (is_pool_ptr(ptr)) {
        /* Can't realloc pool memory — allocate new and copy */
        init_pool();
        void *new_ptr = pool_alloc(size);
        if (new_ptr) {
            /* We don't know old size, so copy up to new size
             * (excess is from pool which is zeroed) */
            size_t max_old = pool_base + POOL_SIZE - (char *)ptr;
            size_t copy_size = size < max_old ? size : max_old;
            memcpy(new_ptr, ptr, copy_size);
            return new_ptr;
        }
        /* Pool full — fall back to real malloc */
        new_ptr = real_malloc(size);
        if (new_ptr) {
            size_t max_old2 = pool_base + POOL_SIZE - (char *)ptr;
            size_t copy_size2 = size < max_old2 ? size : max_old2;
            memcpy(new_ptr, ptr, copy_size2);
        }
        return new_ptr;
    }

    if (is_bootstrap_ptr(ptr)) {
        void *new_ptr = real_malloc(size);
        if (new_ptr) {
            size_t max_old = bootstrap_buf + sizeof(bootstrap_buf) - (char *)ptr;
            size_t copy_size = size < max_old ? size : max_old;
            memcpy(new_ptr, ptr, copy_size);
        }
        return new_ptr;
    }

    return real_realloc(ptr, size);
}

/* ── APM pool activation ──────────────────────────────────────────── */
/* The test harness calls this before/after APM to activate pool mode */

void apm_pool_activate(void) {
    init_pool();
    pool_active = 1;
    pool_pos = 0;  /* Reset pool for fresh APM run */
}

void apm_pool_deactivate(void) {
    pool_active = 0;
}
