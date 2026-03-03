# Makefile for apm-runner — CLI wrapper for Navy APM engine
#
# The APM engine (libapm_linux.so) is loaded at runtime via dlopen().
# The memory pool (libapmsafe.so) must be LD_PRELOAD'd to handle the
# gfortran 4.9 → 15 ABI mismatch.
#
# Prerequisites: gcc, libgfortran5 (runtime dep of libapm_linux.so)
# Usage: make        — build apm-runner + pool library
#        make test   — run version check + propagation test
#        make clean  — remove build artifacts

CC       = gcc
CFLAGS   = -O2 -Wall -Wextra -std=c11 -D_GNU_SOURCE
LDFLAGS  = -Wl,-rpath,'$$ORIGIN/lib'
LIBS     = -ldl -lm

TARGET   = apm-runner
SOURCES  = apm-runner.c apm-bridge.c
HEADERS  = apm-bridge.h
OBJECTS  = $(SOURCES:.c=.o)
POOL_LIB = lib/libapmsafe.so
POOL_SRC = lib/preload_apm_safe.c

.PHONY: all clean test

all: $(TARGET) $(POOL_LIB)

$(TARGET): $(OBJECTS)
	$(CC) $(CFLAGS) -o $@ $(OBJECTS) $(LDFLAGS) $(LIBS)

$(POOL_LIB): $(POOL_SRC)
	$(CC) -O2 -shared -fPIC -D_GNU_SOURCE -o $@ $< -ldl

%.o: %.c $(HEADERS)
	$(CC) $(CFLAGS) -c $< -o $@

test: $(TARGET) $(POOL_LIB)
	@echo "=== APM Version Test ==="
	echo '{"mode":"version"}' | LD_PRELOAD=$(POOL_LIB) ./$(TARGET)
	@echo ""
	@echo "=== APM Single Test (flat terrain, 50 steps, 10km) ==="
	@python3 -c '\
import json; \
steps=50; maxr=10000; ss=maxr/steps; \
d=[i*ss for i in range(steps)]; \
e=[0.0]*steps; \
j={"mode":"single","frequency":500,"polarization":1,"txHeight":5,"rxHeight":2,\
"maxRange":maxr,"numSteps":steps,"distances":d,"elevation":e,\
"refractHeights":[0],"refractM":[0,4000],"atmosN":[339,811]}; \
print(json.dumps(j))' | LD_PRELOAD=$(POOL_LIB) ./$(TARGET) 2>/dev/null | python3 -m json.tool
	@echo ""

clean:
	rm -f $(TARGET) $(OBJECTS)
