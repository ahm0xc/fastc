# fastc

A fast internet speed test CLI powered by fast.com.

![Demo](./assets/demo.gif)

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

## How it works

`fastc` fetches test targets from fast.com, runs concurrent download and upload streams for ~10 seconds each, and reports your measured throughput. It automatically handles token refresh when needed.

## Support

- **Issues**: https://github.com/ahm0xc/fastc/issues
- **Author**: [ahm0xc](https://www.ahm0xc.me/)
