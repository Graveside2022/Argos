/**
 * apm-bridge.c — C bridge to Navy APM engine via ApmLibRun.
 *
 * Loads libapm_linux.so at runtime and provides a clean C API for calling
 * GetVersion and ApmLibRun.
 *
 * CRITICAL: Each APM call runs in a fork()ed child process with
 * LD_PRELOAD=libapmsafe.so (memory pool) to handle gfortran 4.9→15
 * ABI mismatch. The pool library intercepts malloc/calloc/realloc/free
 * globally, routing APM-internal allocations to a 64MB mmap region
 * where free() is a no-op.
 *
 * The child activates the pool right before ApmLibRun and writes
 * results to a pipe. The parent reads results and reaps the child.
 *
 * Config struct layout (232 bytes):
 *   +0    double   txHeight
 *   +8    double   0.5
 *   +24   double   frequency (MHz)
 *   +32   double   5000.0
 *   +56   double   maxRange (meters)
 *   +64   double   1.0
 *   +72   double   10.0
 *   +128  int64    4242 (magic)
 *   +140  int32    1
 *   +144  int32    1
 *   +152  int32    numSteps
 *   +156  int32    2 (refractM inner dim)
 *   +164  int32    1 (refractH.length)
 *   +168  int32    numSteps (OUTPUT COUNT)
 *   +176  int32    20 (max subgrid)
 *   +180  int32    1
 *   +224  int32    10 (APM mode)
 */

#include "apm-bridge.h"
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>
#include <sys/wait.h>
#include <fcntl.h>

/* ── Library handle and function pointers ─────────────────────────── */

static void *g_lib = NULL;

typedef void (*GetVersionFunc)(char *);

typedef void (*ApmLibRunFunc)(
    void *, int32_t *, float *, void *, void *, void *,
    double *, double *, void *, double *, double *, void *, void *,
    double *, double *, double *, double *, double *,
    double *, double *, void *, double *, void *,
    int32_t *, int32_t *, float *, float *, void *, void *, void *
);

/* Weak symbols — resolved when LD_PRELOAD=libapmsafe.so */
extern void apm_pool_activate(void) __attribute__((weak));
extern void apm_pool_deactivate(void) __attribute__((weak));

static GetVersionFunc g_getVersion = NULL;
static ApmLibRunFunc  g_apmLibRun  = NULL;

int apm_init(const char *lib_path) {
    if (g_lib) return 0;

    g_lib = dlopen(lib_path, RTLD_NOW);
    if (!g_lib) {
        fprintf(stderr, "apm_init: dlopen failed: %s\n", dlerror());
        return APM_ERR_LOAD;
    }

    g_getVersion = (GetVersionFunc)dlsym(g_lib, "GetVersion");
    if (!g_getVersion) {
        fprintf(stderr, "apm_init: GetVersion not found\n");
        dlclose(g_lib); g_lib = NULL;
        return APM_ERR_SYMBOL;
    }

    g_apmLibRun = (ApmLibRunFunc)dlsym(g_lib, "ApmLibRun");
    if (!g_apmLibRun) {
        fprintf(stderr, "apm_init: ApmLibRun not found\n");
        dlclose(g_lib); g_lib = NULL;
        return APM_ERR_SYMBOL;
    }

    return APM_OK;
}

void apm_cleanup(void) {
    if (g_lib) {
        dlclose(g_lib);
        g_lib = NULL;
        g_getVersion = NULL;
        g_apmLibRun = NULL;
    }
}

int apm_get_version(char *version, int version_len) {
    if (!g_lib || !g_getVersion) return APM_ERR_LOAD;

    char buf[512];
    memset(buf, 0, sizeof(buf));
    g_getVersion(buf);

    int len = 32;
    while (len > 0 && (buf[len - 1] == ' ' || buf[len - 1] == '\0')) len--;
    if (len >= version_len) len = version_len - 1;
    memcpy(version, buf, len);
    version[len] = '\0';

    return APM_OK;
}

/* ── Pipe result struct ───────────────────────────────────────────── */

typedef struct {
    int32_t error;
    int32_t num_values;
} PipeHeader;

#define SENTINEL_FLOAT (-32767.0f)
#define MAX_SUBGRID    21
#define BUF_PAD        100
#define WORK_BUF_SIZE  8192
#define HEAP_SIZE      (1024 * 1024)

int apm_run_single(
    double frequency,
    int polarization,
    double tx_height,
    double rx_height,
    double max_range,
    int num_steps,
    const double *distances,
    const double *elevation,
    const double *refract_heights,
    int num_refract,
    const double *refract_m,
    const double *atmos_n,
    float *loss_out
) {
    if (!g_lib || !g_apmLibRun) return APM_ERR_LOAD;
    (void)polarization;

    int padded = num_steps + BUF_PAD;

    int pipefd[2];
    if (pipe(pipefd) != 0) return APM_ERR_RUN;

    fflush(stdout);
    fflush(stderr);

    pid_t pid = fork();
    if (pid < 0) {
        close(pipefd[0]); close(pipefd[1]);
        return APM_ERR_RUN;
    }

    if (pid == 0) {
        /* ── CHILD PROCESS ──────────────────────────────────────── */
        close(pipefd[0]);
        signal(SIGPIPE, SIG_IGN);

        /* Suppress stderr */
        int devnull = open("/dev/null", O_WRONLY);
        if (devnull >= 0) { dup2(devnull, 2); close(devnull); }

        /* ── Build 232-byte config struct ───────────────────── */
        unsigned char config[232];
        memset(config, 0, sizeof(config));

        *(double *)(config + 0)    = tx_height;
        *(double *)(config + 8)    = 0.5;
        *(double *)(config + 24)   = frequency;
        *(double *)(config + 32)   = 5000.0;
        *(double *)(config + 56)   = max_range;
        *(double *)(config + 64)   = 1.0;
        *(double *)(config + 72)   = 10.0;
        *(int64_t *)(config + 128) = 4242;
        *(int32_t *)(config + 140) = 1;
        *(int32_t *)(config + 144) = 1;
        *(int32_t *)(config + 152) = num_steps;
        *(int32_t *)(config + 156) = 2;
        *(int32_t *)(config + 164) = 1;
        *(int32_t *)(config + 168) = num_steps;  /* OUTPUT COUNT */
        *(int32_t *)(config + 176) = 20;
        *(int32_t *)(config + 180) = 1;
        *(int32_t *)(config + 224) = 10;

        /* ── Allocate buffers (using real malloc, pool inactive) ─ */
        double *dists = (double *)calloc(padded, sizeof(double));
        double *elev  = (double *)calloc(padded, sizeof(double));
        for (int i = 0; i < num_steps; i++) {
            dists[i] = distances[i];
            elev[i]  = elevation[i];
        }

        double refractH[1] = {0.0};

        /* Refractivity arrays MUST be heap-allocated and generously padded.
         * APM's gfortran 4.9 code reads beyond nominal bounds due to
         * array descriptor ABI mismatch. Stack arrays cause error -40510. */
        int refract_buf_size = num_steps * 2;
        double *refractM_2d = (double *)calloc(refract_buf_size, sizeof(double));
        double *atmosN_2d   = (double *)calloc(refract_buf_size, sizeof(double));

        /* Default: standard atmosphere */
        refractM_2d[0] = 0.0;   refractM_2d[1] = 4000.0;
        atmosN_2d[0]   = 339.0; atmosN_2d[1]   = 811.0;

        if (num_refract >= 2 && refract_m && atmos_n) {
            refractM_2d[0] = refract_m[0];
            refractM_2d[1] = refract_m[1];
            atmosN_2d[0]   = atmos_n[0];
            atmosN_2d[1]   = atmos_n[1];
        }
        if (num_refract >= 1 && refract_heights) {
            refractH[0] = refract_heights[0];
        }

        int32_t err_buf = 0;
        float *loss_int = (float *)calloc(padded, sizeof(float));
        double dbl_buf = 0.0;
        double rx_ht = rx_height;
        double dbl_buf2[2] = {0.0, 0.0};
        double *buf_2d  = (double *)calloc(WORK_BUF_SIZE, sizeof(double));
        double *rh1     = (double *)calloc(WORK_BUF_SIZE, sizeof(double));
        double *rh2     = (double *)calloc(WORK_BUF_SIZE, sizeof(double));
        void   *heap    = calloc(1, HEAP_SIZE);
        double *od      = (double *)calloc(WORK_BUF_SIZE, sizeof(double));

        int ss = padded * MAX_SUBGRID;
        int32_t *sa = (int32_t *)calloc(ss, sizeof(int32_t));
        int32_t *sb = (int32_t *)calloc(ss, sizeof(int32_t));
        float *lo   = (float *)calloc(padded, sizeof(float));
        float *sc   = (float *)calloc(padded, sizeof(float));

        /* Fill sentinel values (only numSteps, not padded — matches ATAK) */
        union { float f; int32_t i; } sv;
        sv.f = SENTINEL_FLOAT;
        for (int i = 0; i < ss; i++) { sa[i] = sv.i; sb[i] = sv.i; }
        for (int i = 0; i < num_steps; i++) {
            lo[i] = SENTINEL_FLOAT;
            sc[i] = SENTINEL_FLOAT;
        }

        int32_t result[10] = {0};
        result[0] = -42;
        result[1] = num_steps;
        result[2] = num_steps;

        /* ── Activate pool right before APM call ────────────── */
        if (apm_pool_activate) apm_pool_activate();

        g_apmLibRun(
            config, &err_buf, loss_int, NULL, NULL, NULL,
            &dbl_buf, refractH, NULL, dists, elev, NULL, NULL,
            &rx_ht, dbl_buf2, buf_2d, refractM_2d, atmosN_2d,
            rh1, rh2, heap, od, NULL,
            sa, sb, lo, sc, NULL, NULL, result
        );

        if (apm_pool_deactivate) apm_pool_deactivate();

        /* ── Write results to pipe ──────────────────────────── */
        PipeHeader hdr;
        hdr.error = result[0];
        hdr.num_values = num_steps;
        write(pipefd[1], &hdr, sizeof(hdr));
        write(pipefd[1], lo, num_steps * sizeof(float));

        close(pipefd[1]);
        _exit(0);
    }

    /* ── PARENT PROCESS ─────────────────────────────────────────── */
    close(pipefd[1]);

    PipeHeader hdr;
    ssize_t n = read(pipefd[0], &hdr, sizeof(hdr));

    int apm_error = APM_ERR_RUN;
    if (n == (ssize_t)sizeof(hdr)) {
        apm_error = hdr.error;

        ssize_t expected = num_steps * sizeof(float);
        ssize_t total = 0;
        while (total < expected) {
            n = read(pipefd[0], ((char *)loss_out) + total, expected - total);
            if (n <= 0) break;
            total += n;
        }

        for (int i = 0; i < num_steps; i++) {
            if (loss_out[i] <= SENTINEL_FLOAT + 1.0f) {
                loss_out[i] = 0.0f;
            }
        }
    }

    close(pipefd[0]);

    int status;
    waitpid(pid, &status, 0);

    if (WIFSIGNALED(status)) {
        fprintf(stderr, "apm_run_single: child crashed (sig=%d)\n",
                WTERMSIG(status));
        if (apm_error == 0) apm_error = APM_ERR_RUN;
    }

    return apm_error;
}
