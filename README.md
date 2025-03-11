# RingCentral C# Code Generator CI Test

This repo is to experiment RingCentral C# Code Generation in a CI pipeline.

## Production

### Install

```
yarn global add generate-rc-cs-code
```

### Run

```
generate-rc-cs-code -i /path/to/rc-platform.yml
```

There is an optional options `-o outputFolder`. If you specify it, then files
will be generated in that folder. Otherwise it is just "dry run" without
generating files.

## Development

### setup

```
yarn install
```

### Test

```
yarn test -i /Users/tyler.liu/src/ts/rc-cs-codegen-ci-test/rc-platform-internal.yml -o /Users/tyler.liu/src/ts/rc-cs-codegen-ci-test/temp
```
