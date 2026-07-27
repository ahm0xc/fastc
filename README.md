# fastc

A fast internet speed test CLI powered by fast.com.

## Installation

```bash
npm i -g @ahm0xc/fastc
```

## Usage

Run the speed test with a single command:

```bash
fastc
```

The test measures both **download** and **upload** speeds using fast.com's infrastructure. Results are displayed in Mbps (or Gbps for connections above 1 Gbps).

```
↓ 123.45 Mbps  ⣀⣤⣶⣿⣿⣶⣤⣀⣤⣶⣿⣿⣿⣶⣤⣀  peak 150.00 Mbps
↑  45.67 Mbps  ⣀⣤⣶⣿⣿⣶⣤⣀⣤⣶⣿⣶⣤⣀⣤  peak  60.00 Mbps
```

- **↓** — download speed
- **↑** — upload speed
- **Sparkline** — real-time speed history during the test
- **Peak** — highest speed recorded during the test window

## How it works

`fastc` fetches test targets from fast.com, runs concurrent download and upload streams for ~10 seconds each, and reports your measured throughput. It automatically handles token refresh when needed.

## Support

- **Issues**: https://github.com/ahm0xc/fastc/issues
- **Author**: [ahm0xc](https://github.com/ahm0xc)
