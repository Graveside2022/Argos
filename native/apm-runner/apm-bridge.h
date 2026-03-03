/**
 * apm-bridge.h — C bridge to Navy APM (Advanced Propagation Model) engine.
 *
 * Each APM call is fork-isolated with a 64MB memory pool to work around
 * the gfortran 4.9 → 15 ABI mismatch. The child process calls ApmLibRun,
 * writes results to a pipe, and _exit()s.
 */

#ifndef APM_BRIDGE_H
#define APM_BRIDGE_H

#include <stdint.h>

/* APM error codes */
#define APM_OK             0
#define APM_ERR_LOAD      -1
#define APM_ERR_SYMBOL    -2
#define APM_ERR_VERSION   -3
#define APM_ERR_RUN       -4
#define APM_ERR_ALLOC     -5

/* Limits */
#define APM_MAX_RANGE_STEPS  500
#define APM_MAX_REFRACT_LVLS 20
#define APM_MAX_SUBGRID      21

/* Sentinel value for uncomputed propagation points */
#define APM_SENTINEL_FLOAT  (-32767.0f)

/**
 * Initialize the APM library (load shared object).
 * @return 0 on success, negative on error
 */
int apm_init(const char *lib_path);

/**
 * Clean up APM library resources.
 */
void apm_cleanup(void);

/**
 * Get APM engine version string.
 * @return 0 on success, negative on error
 */
int apm_get_version(char *version, int version_len);

/**
 * Run a single APM propagation calculation along one azimuth.
 *
 * Forks a child process, activates a 64MB memory pool, calls ApmLibRun
 * with the correct 232-byte config struct, and reads results via pipe.
 *
 * @param frequency      Frequency in MHz
 * @param polarization   0 = horizontal, 1 = vertical
 * @param tx_height      Transmitter height in meters AGL
 * @param rx_height      Receiver height in meters AGL
 * @param max_range      Maximum range in meters
 * @param num_steps      Number of range steps (max 500)
 * @param distances      Array of distances (meters), length num_steps
 * @param elevation      Array of terrain elevation (meters MSL), length num_steps
 * @param refract_heights Array of refractivity profile heights
 * @param num_refract    Number of refractivity levels (typically 2)
 * @param refract_m      Refractivity M-units at each height
 * @param atmos_n        Atmosphere N at each height
 * @param loss_out       Output: propagation factor in dB, length num_steps
 * @return APM error code (0 = success)
 */
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
);

#endif /* APM_BRIDGE_H */
