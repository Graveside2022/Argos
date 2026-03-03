/**
 * apm-runner.c — CLI wrapper for Navy APM propagation engine.
 *
 * Reads JSON from stdin, calls APM engine, writes JSON to stdout.
 * Designed for invocation via Node.js execFileAsync() (no shell).
 *
 * Modes:
 *   {"mode":"version"}
 *     -> {"version":"5.3.4.0","error":0}
 *
 *   {"mode":"single","frequency":500,"polarization":1,"txHeight":5,"rxHeight":5,
 *    "maxRange":20000,"numSteps":100,"distances":[...],"elevation":[...],
 *    "refractHeights":[0,4000],"refractM":[339,811],"atmosN":[339,811]}
 *     -> {"error":0,"loss":[72.3,85.1,...]}
 *
 *   {"mode":"coverage","frequency":500,...,"azimuths":[
 *     {"azimuth":0,"distances":[...],"elevation":[...],...},
 *     ...
 *   ]}
 *     -> {"error":0,"results":[{"azimuth":0,"loss":[...]},...],"version":"5.3.4.0"}
 *
 * JSON parsing uses a minimal hand-rolled parser (no external deps).
 * Input is limited to 16MB to prevent OOM on RPi 5.
 */

#include "apm-bridge.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <unistd.h>
#include <libgen.h>
#include <linux/limits.h>

#define MAX_INPUT_SIZE  (16 * 1024 * 1024)  /* 16 MB */
#define MAX_JSON_TOKENS 200000
#define VERSION_BUF_LEN 128

/* ── Minimal JSON parser ─────────────────────────────────────────────── */

typedef enum {
    TOK_NONE, TOK_LBRACE, TOK_RBRACE, TOK_LBRACKET, TOK_RBRACKET,
    TOK_COLON, TOK_COMMA, TOK_STRING, TOK_NUMBER, TOK_TRUE, TOK_FALSE, TOK_NULL
} TokenType;

typedef struct {
    TokenType type;
    const char *start;
    int len;
} Token;

static Token g_tokens[MAX_JSON_TOKENS];
static int g_num_tokens;

static int tokenize(const char *json, int json_len) {
    int i = 0, t = 0;
    while (i < json_len && t < MAX_JSON_TOKENS) {
        char c = json[i];
        if (c == ' ' || c == '\t' || c == '\n' || c == '\r') { i++; continue; }
        if (c == '{') { g_tokens[t++] = (Token){TOK_LBRACE, &json[i], 1}; i++; }
        else if (c == '}') { g_tokens[t++] = (Token){TOK_RBRACE, &json[i], 1}; i++; }
        else if (c == '[') { g_tokens[t++] = (Token){TOK_LBRACKET, &json[i], 1}; i++; }
        else if (c == ']') { g_tokens[t++] = (Token){TOK_RBRACKET, &json[i], 1}; i++; }
        else if (c == ':') { g_tokens[t++] = (Token){TOK_COLON, &json[i], 1}; i++; }
        else if (c == ',') { g_tokens[t++] = (Token){TOK_COMMA, &json[i], 1}; i++; }
        else if (c == '"') {
            i++;
            int start = i;
            while (i < json_len && json[i] != '"') {
                if (json[i] == '\\') i++;
                i++;
            }
            g_tokens[t++] = (Token){TOK_STRING, &json[start], i - start};
            i++;
        }
        else if (c == '-' || (c >= '0' && c <= '9')) {
            int start = i;
            if (c == '-') i++;
            while (i < json_len && ((json[i] >= '0' && json[i] <= '9') || json[i] == '.' || json[i] == 'e' || json[i] == 'E' || json[i] == '+' || json[i] == '-')) i++;
            g_tokens[t++] = (Token){TOK_NUMBER, &json[start], i - start};
        }
        else if (strncmp(&json[i], "true", 4) == 0)  { g_tokens[t++] = (Token){TOK_TRUE, &json[i], 4}; i += 4; }
        else if (strncmp(&json[i], "false", 5) == 0) { g_tokens[t++] = (Token){TOK_FALSE, &json[i], 5}; i += 5; }
        else if (strncmp(&json[i], "null", 4) == 0)  { g_tokens[t++] = (Token){TOK_NULL, &json[i], 4}; i += 4; }
        else { i++; } /* skip unknown */
    }
    g_num_tokens = t;
    return t;
}

static int tok_str_eq(int idx, const char *s) {
    if (idx >= g_num_tokens || g_tokens[idx].type != TOK_STRING) return 0;
    int slen = strlen(s);
    return (g_tokens[idx].len == slen && strncmp(g_tokens[idx].start, s, slen) == 0);
}

static double tok_to_double(int idx) {
    if (idx >= g_num_tokens) return 0.0;
    char buf[64];
    int len = g_tokens[idx].len;
    if (len > 63) len = 63;
    memcpy(buf, g_tokens[idx].start, len);
    buf[len] = '\0';
    return strtod(buf, NULL);
}

static int tok_to_int(int idx) {
    return (int)tok_to_double(idx);
}

/* Find value token for a key at the current object level starting from pos.
 * Returns token index of the value, or -1 if not found. */
static int find_key(const char *key, int start, int end) {
    for (int i = start; i < end - 2; i++) {
        if (tok_str_eq(i, key) && g_tokens[i + 1].type == TOK_COLON) {
            return i + 2;
        }
    }
    return -1;
}

/* Parse a JSON array of numbers into a pre-allocated double array.
 * Returns the number of elements parsed. */
static int parse_double_array(int start_tok, double *out, int max_len) {
    if (start_tok >= g_num_tokens || g_tokens[start_tok].type != TOK_LBRACKET)
        return 0;

    int count = 0;
    int i = start_tok + 1;
    while (i < g_num_tokens && g_tokens[i].type != TOK_RBRACKET && count < max_len) {
        if (g_tokens[i].type == TOK_NUMBER) {
            out[count++] = tok_to_double(i);
        }
        i++;
    }
    return count;
}

/* Find the end of a JSON value (object, array, or primitive) starting at tok_idx */
static int skip_value(int tok_idx) {
    if (tok_idx >= g_num_tokens) return tok_idx;
    TokenType t = g_tokens[tok_idx].type;
    if (t == TOK_LBRACE) {
        int depth = 1;
        int i = tok_idx + 1;
        while (i < g_num_tokens && depth > 0) {
            if (g_tokens[i].type == TOK_LBRACE) depth++;
            else if (g_tokens[i].type == TOK_RBRACE) depth--;
            i++;
        }
        return i;
    }
    if (t == TOK_LBRACKET) {
        int depth = 1;
        int i = tok_idx + 1;
        while (i < g_num_tokens && depth > 0) {
            if (g_tokens[i].type == TOK_LBRACKET) depth++;
            else if (g_tokens[i].type == TOK_RBRACKET) depth--;
            i++;
        }
        return i;
    }
    return tok_idx + 1;
}

/* ── JSON output helpers ─────────────────────────────────────────────── */

static void json_start_obj(void)  { putchar('{'); }
static void json_end_obj(void)    { putchar('}'); }
static void json_start_arr(void)  { putchar('['); }
static void json_end_arr(void)    { putchar(']'); }
static void json_comma(void)      { putchar(','); }

static void json_key(const char *k) {
    printf("\"%s\":", k);
}

static void json_string(const char *k, const char *v) {
    printf("\"%s\":\"%s\"", k, v);
}

static void json_int(const char *k, int v) {
    printf("\"%s\":%d", k, v);
}

static void json_double(const char *k, double v) {
    if (isnan(v) || isinf(v)) {
        printf("\"%s\":null", k);
    } else {
        printf("\"%s\":%.6g", k, v);
    }
}

static void json_float_array(const char *k, const float *arr, int len) {
    printf("\"%s\":[", k);
    for (int i = 0; i < len; i++) {
        if (i > 0) putchar(',');
        if (isnan(arr[i]) || isinf(arr[i])) {
            printf("null");
        } else {
            printf("%.2f", arr[i]);
        }
    }
    putchar(']');
}

/* ── Main ─────────────────────────────────────────────────────────────── */

static char *read_stdin(int *out_len) {
    char *buf = (char *)malloc(MAX_INPUT_SIZE);
    if (!buf) return NULL;

    int total = 0;
    while (total < MAX_INPUT_SIZE) {
        int n = fread(buf + total, 1, MAX_INPUT_SIZE - total, stdin);
        if (n <= 0) break;
        total += n;
    }
    *out_len = total;
    return buf;
}

static void resolve_lib_path(const char *argv0, char *lib_path, int lib_path_len) {
    /* Try /proc/self/exe first for reliable path resolution */
    char exe_path[PATH_MAX];
    ssize_t len = readlink("/proc/self/exe", exe_path, sizeof(exe_path) - 1);
    if (len > 0) {
        exe_path[len] = '\0';
    } else {
        strncpy(exe_path, argv0, PATH_MAX - 1);
        exe_path[PATH_MAX - 1] = '\0';
    }
    char *dir = dirname(exe_path);
    snprintf(lib_path, lib_path_len, "%s/lib/libapm_linux.so", dir);
}

int main(int argc, char *argv[]) {
    /* Resolve library path */
    char lib_path[PATH_MAX];
    if (argc > 1) {
        strncpy(lib_path, argv[1], PATH_MAX - 1);
        lib_path[PATH_MAX - 1] = '\0';
    } else {
        resolve_lib_path(argv[0], lib_path, sizeof(lib_path));
    }

    /* Initialize APM */
    int rc = apm_init(lib_path);
    if (rc != 0) {
        json_start_obj();
        json_int("error", rc);
        json_comma();
        json_string("message", "Failed to load APM library");
        json_end_obj();
        putchar('\n');
        return 1;
    }

    /* Read input */
    int input_len = 0;
    char *input = read_stdin(&input_len);
    if (!input || input_len == 0) {
        json_start_obj();
        json_int("error", -10);
        json_comma();
        json_string("message", "No input");
        json_end_obj();
        putchar('\n');
        apm_cleanup();
        return 1;
    }

    /* Tokenize */
    tokenize(input, input_len);

    /* Find mode */
    int mode_tok = find_key("mode", 0, g_num_tokens);
    if (mode_tok < 0) {
        json_start_obj();
        json_int("error", -11);
        json_comma();
        json_string("message", "Missing mode field");
        json_end_obj();
        putchar('\n');
        free(input);
        apm_cleanup();
        return 1;
    }

    /* ── Version mode ─────────────────────────────────────────── */
    if (tok_str_eq(mode_tok, "version")) {
        char version[VERSION_BUF_LEN];
        rc = apm_get_version(version, sizeof(version));
        json_start_obj();
        json_string("version", rc == 0 ? version : "unknown");
        json_comma();
        json_int("error", rc);
        json_end_obj();
        putchar('\n');
        free(input);
        apm_cleanup();
        return 0;
    }

    /* ── Single mode (one azimuth) ────────────────────────────── */
    if (tok_str_eq(mode_tok, "single")) {
        int freq_tok     = find_key("frequency", 0, g_num_tokens);
        int pol_tok      = find_key("polarization", 0, g_num_tokens);
        int txht_tok     = find_key("txHeight", 0, g_num_tokens);
        int rxht_tok     = find_key("rxHeight", 0, g_num_tokens);
        int range_tok    = find_key("maxRange", 0, g_num_tokens);
        int steps_tok    = find_key("numSteps", 0, g_num_tokens);
        int dist_tok     = find_key("distances", 0, g_num_tokens);
        int elev_tok     = find_key("elevation", 0, g_num_tokens);
        int rh_tok       = find_key("refractHeights", 0, g_num_tokens);
        int rm_tok       = find_key("refractM", 0, g_num_tokens);
        int an_tok       = find_key("atmosN", 0, g_num_tokens);

        if (freq_tok < 0 || dist_tok < 0 || elev_tok < 0) {
            json_start_obj();
            json_int("error", -12);
            json_comma();
            json_string("message", "Missing required fields for single mode");
            json_end_obj();
            putchar('\n');
            free(input);
            apm_cleanup();
            return 1;
        }

        double frequency   = freq_tok >= 0 ? tok_to_double(freq_tok) : 500.0;
        int polarization   = pol_tok >= 0 ? tok_to_int(pol_tok) : 1;
        double tx_height   = txht_tok >= 0 ? tok_to_double(txht_tok) : 5.0;
        double rx_height   = rxht_tok >= 0 ? tok_to_double(rxht_tok) : 5.0;
        int num_steps      = steps_tok >= 0 ? tok_to_int(steps_tok) : 100;
        double max_range   = range_tok >= 0 ? tok_to_double(range_tok) : 20000.0;

        if (num_steps > APM_MAX_RANGE_STEPS) num_steps = APM_MAX_RANGE_STEPS;

        double *distances = (double *)calloc(num_steps, sizeof(double));
        double *elevation = (double *)calloc(num_steps, sizeof(double));
        float  *loss      = (float *)calloc(num_steps, sizeof(float));
        double refract_h[APM_MAX_REFRACT_LVLS] = {0.0, 4000.0};
        double refract_m[APM_MAX_REFRACT_LVLS] = {339.0, 811.0};
        double atmos_n[APM_MAX_REFRACT_LVLS]   = {339.0, 811.0};
        int num_refract = 2;

        parse_double_array(dist_tok, distances, num_steps);
        parse_double_array(elev_tok, elevation, num_steps);
        if (rh_tok >= 0) num_refract = parse_double_array(rh_tok, refract_h, APM_MAX_REFRACT_LVLS);
        if (rm_tok >= 0) parse_double_array(rm_tok, refract_m, num_refract);
        if (an_tok >= 0) parse_double_array(an_tok, atmos_n, num_refract);

        rc = apm_run_single(
            frequency, polarization, tx_height, rx_height, max_range,
            num_steps, distances, elevation,
            refract_h, num_refract, refract_m, atmos_n,
            loss
        );

        json_start_obj();
        json_int("error", rc);
        json_comma();
        json_float_array("loss", loss, num_steps);
        json_end_obj();
        putchar('\n');

        free(distances);
        free(elevation);
        free(loss);
        free(input);
        apm_cleanup();
        return rc != 0 ? 1 : 0;
    }

    /* ── Coverage mode (multiple azimuths) ────────────────────── */
    if (tok_str_eq(mode_tok, "coverage")) {
        int freq_tok     = find_key("frequency", 0, g_num_tokens);
        int pol_tok      = find_key("polarization", 0, g_num_tokens);
        int txht_tok     = find_key("txHeight", 0, g_num_tokens);
        int rxht_tok     = find_key("rxHeight", 0, g_num_tokens);
        int range_tok    = find_key("maxRange", 0, g_num_tokens);
        int steps_tok    = find_key("numSteps", 0, g_num_tokens);
        int az_tok       = find_key("azimuths", 0, g_num_tokens);

        double frequency   = freq_tok >= 0 ? tok_to_double(freq_tok) : 500.0;
        int polarization   = pol_tok >= 0 ? tok_to_int(pol_tok) : 1;
        double tx_height   = txht_tok >= 0 ? tok_to_double(txht_tok) : 5.0;
        double rx_height   = rxht_tok >= 0 ? tok_to_double(rxht_tok) : 5.0;
        double max_range   = range_tok >= 0 ? tok_to_double(range_tok) : 20000.0;
        int num_steps      = steps_tok >= 0 ? tok_to_int(steps_tok) : 100;

        if (num_steps > APM_MAX_RANGE_STEPS) num_steps = APM_MAX_RANGE_STEPS;

        if (az_tok < 0 || g_tokens[az_tok].type != TOK_LBRACKET) {
            json_start_obj();
            json_int("error", -13);
            json_comma();
            json_string("message", "Missing azimuths array");
            json_end_obj();
            putchar('\n');
            free(input);
            apm_cleanup();
            return 1;
        }

        /* Get version for output */
        char version[VERSION_BUF_LEN];
        apm_get_version(version, sizeof(version));

        /* Allocate shared buffers */
        double *distances = (double *)calloc(num_steps, sizeof(double));
        double *elevation = (double *)calloc(num_steps, sizeof(double));
        float  *loss      = (float *)calloc(num_steps, sizeof(float));

        /* Start output */
        json_start_obj();
        json_int("error", 0);
        json_comma();
        json_string("version", version);
        json_comma();
        json_key("results");
        json_start_arr();

        /* Iterate over azimuth objects in the array */
        int first_result = 1;
        int i = az_tok + 1; /* skip '[' */
        while (i < g_num_tokens && g_tokens[i].type != TOK_RBRACKET) {
            if (g_tokens[i].type == TOK_COMMA) { i++; continue; }
            if (g_tokens[i].type != TOK_LBRACE) { i++; continue; }

            /* Find end of this azimuth object */
            int obj_end = skip_value(i);

            /* Parse azimuth object fields */
            int az_val_tok  = find_key("azimuth", i, obj_end);
            int dist_tok    = find_key("distances", i, obj_end);
            int elev_tok    = find_key("elevation", i, obj_end);
            int rh_tok      = find_key("refractHeights", i, obj_end);
            int rm_tok      = find_key("refractM", i, obj_end);
            int an_tok      = find_key("atmosN", i, obj_end);

            double azimuth = az_val_tok >= 0 ? tok_to_double(az_val_tok) : 0.0;

            double refract_h[APM_MAX_REFRACT_LVLS] = {0.0, 4000.0};
            double refract_m[APM_MAX_REFRACT_LVLS] = {339.0, 811.0};
            double atmos_n[APM_MAX_REFRACT_LVLS]   = {339.0, 811.0};
            int num_refract = 2;

            memset(distances, 0, num_steps * sizeof(double));
            memset(elevation, 0, num_steps * sizeof(double));
            memset(loss, 0, num_steps * sizeof(float));

            if (dist_tok >= 0) parse_double_array(dist_tok, distances, num_steps);
            if (elev_tok >= 0) parse_double_array(elev_tok, elevation, num_steps);
            if (rh_tok >= 0) num_refract = parse_double_array(rh_tok, refract_h, APM_MAX_REFRACT_LVLS);
            if (rm_tok >= 0) parse_double_array(rm_tok, refract_m, num_refract);
            if (an_tok >= 0) parse_double_array(an_tok, atmos_n, num_refract);

            int err = apm_run_single(
                frequency, polarization, tx_height, rx_height, max_range,
                num_steps, distances, elevation,
                refract_h, num_refract, refract_m, atmos_n,
                loss
            );

            if (!first_result) json_comma();
            first_result = 0;

            json_start_obj();
            json_double("azimuth", azimuth);
            json_comma();
            json_int("error", err);
            json_comma();
            json_float_array("loss", loss, num_steps);
            json_end_obj();

            if (err != 0 && err != -10210) {
                /* Fatal APM error — stop processing further azimuths */
                /* Update top-level error */
                break;
            }

            i = obj_end;
        }

        json_end_arr();
        json_end_obj();
        putchar('\n');

        free(distances);
        free(elevation);
        free(loss);
        free(input);
        apm_cleanup();
        return 0;
    }

    /* Unknown mode */
    json_start_obj();
    json_int("error", -14);
    json_comma();
    json_string("message", "Unknown mode");
    json_end_obj();
    putchar('\n');

    free(input);
    apm_cleanup();
    return 1;
}
