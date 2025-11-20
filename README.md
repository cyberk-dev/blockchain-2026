# Blockchain 2026 - Assignment Reports

This repository contains tools for tracking member assignment completion.

## Report Generation Scripts

Two scripts are available to generate reports showing which members have completed assignments 1 and 2:

### 1. Basic Script (`generate_report.py`)

Simple console output only.

```bash
python3 generate_report.py
```

### 2. Enhanced Script (`generate_report_v2.py`)

Generates both console output and a markdown file.

```bash
# Generate both console and markdown report
python3 generate_report_v2.py

# Generate console output only
python3 generate_report_v2.py console

# Generate markdown file only
python3 generate_report_v2.py markdown

# Specify custom members directory
python3 generate_report_v2.py /path/to/members both
```

## How It Works

The scripts scan the `members/` directory and detect completed assignments based on:

1. **Assignment 1** - Detected if member has any of these subdirectories:
   - `01/` or `bai1/` or `b1/` or `l1/`

2. **Assignment 2** - Detected if member has any of these:
   - Subdirectories: `02/` or `bai2/` or `b2/` or `l2/`
   - Or Hardhat project files directly in root (`hardhat.config.ts` or `package.json`)

## Output

### Console Output

Shows a formatted table with:
- Summary statistics (total members, completion rates)
- Individual member status (✓/✗)
- Detailed lists by assignment

### Markdown Output (generate_report_v2.py)

Creates `assignment_report.md` with:
- Summary with percentages
- Formatted table with emojis (✅/❌)
- Detailed member lists
- Timestamp of generation

The markdown file is in `.gitignore` as it's meant to be regenerated on demand.

## Requirements

- Python 3.6 or higher (no additional dependencies required)

## Member Directory Structure

The scripts support various naming conventions used by different members:

- Standard: `01/`, `02/`
- Named: `bai1/`, `bai2/`
- Short: `b1/`, `b2/`
- Custom: `l1/`, `l2/`
- Direct submission: Hardhat files in member root directory (counted as assignment 2)
