# Workflow: Forensic Analysis

**ID:** 11_forensic_analysis
**Risk Level:** LOW — Passive analysis of disk images and files
**Estimated Duration:** 10-120 minutes
**Requires:** Target disk image or suspicious files

## Objective

Perform forensic analysis on disk images, firmware, and binary files
to extract evidence, identify embedded files, and reverse-engineer executables.

## Pre-Flight Checks

1. **Tools available:** `which binwalk bulk_extractor mmls fls r2 jadx apktool`
2. **Sufficient disk space:** Carved files can be large — check with `df -h /tmp`
3. **Target acquired:** Disk image (.dd/.img/.E01) or binary files available locally

## Steps

### Step 1: Disk Image Overview (if analyzing disk)

```bash
npx tsx tactical/modules/module_runner.ts disk_analyzer \
  --image /path/to/image.dd --tool img_stat
```

**Record:** Media type, sector size, total sectors.

### Step 2: Partition Layout

```bash
npx tsx tactical/modules/module_runner.ts disk_analyzer \
  --image /path/to/image.dd --tool mmls
```

**Record:** Partition offsets, sizes, types. Use offset values for fls/icat.

### Step 3: File System Listing

```bash
npx tsx tactical/modules/module_runner.ts disk_analyzer \
  --image /path/to/image.dd --tool fls --offset <PARTITION_OFFSET>
```

**Record:** Interesting files, deleted entries (flagged in output).

### Step 4: Extract Specific File (if needed)

```bash
npx tsx tactical/modules/module_runner.ts disk_analyzer \
  --image /path/to/image.dd --tool icat --offset <OFFSET> --inode <INODE>
```

### Step 5: Binary Analysis

```bash
npx tsx tactical/modules/module_runner.ts binary_analyzer \
  --file /path/to/suspicious_file --signature --entropy
```

**Record:** File type, entropy score (>7.5 suggests encryption/compression).
**If firmware/archive:** Proceed to extraction.

### Step 6: Firmware/Archive Extraction

```bash
npx tsx tactical/modules/module_runner.ts binary_analyzer \
  --file /path/to/firmware.bin --extract --output-dir /tmp/extracted
```

**Record:** Extracted file count, filesystem types found.

### Step 7: File Carving (bulk evidence recovery)

```bash
npx tsx tactical/modules/module_runner.ts file_carver \
  --input-file /path/to/image.dd --output-dir /tmp/carved
```

**Record:** Carved file types and counts.

### Step 8: Reverse Engineering (if executables found)

```bash
npx tsx tactical/modules/module_runner.ts re_analyzer \
  --file /path/to/binary --mode info
```

Follow with `--mode functions`, `--mode strings`, `--mode imports` as needed.

### Step 9: Android APK Analysis (if APK found)

```bash
npx tsx tactical/modules/module_runner.ts android_decompiler \
  --apk /path/to/app.apk --tool both --output-dir /tmp/decompiled
```

**Record:** Permissions, activities, decompiled source paths.

## Abort Conditions

- Disk space exhaustion (carving fills /tmp)
- Corrupt image (tools fail to parse)

## Reporting

- Disk layout: partitions, filesystem types
- Recovered files: count by type, notable findings
- Deleted files: names, inodes, potential relevance
- Binary analysis: file types, entropy, embedded signatures
- APK analysis: permissions, interesting strings, hardcoded URLs/keys
- Evidence chain: tool used, input, output path, timestamp
