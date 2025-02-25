# @qdrant/openapi-typescript-fetch

## 1.2.6

### Patch Changes

- Fix: BigInt conversion issue for scientific notation numbers 


## 1.2.5

### Patch Changes

- Return to Node.js 18 compatibility and skip BigInt support and test until Node 21

## 1.2.4

### Patch Changes

- Native JSON support for response serializing/deserializing long int (BigInt)

## 1.2.3

### Patch Changes

- Temporarily pack json-with-bigint locally until this package supports CJS modules

## 1.2.2

### Patch Changes

- [`2ffe33f`](https://github.com/qdrant/openapi-typescript-fetch/commit/2ffe33f8437d1fcc4bd337dccea4588887591727) Thanks [@Rendez](https://github.com/Rendez)! - Add bigint support using `json-with-bigint` package.

## 1.2.1

### Patch Changes

- [`a2120c3`](https://github.com/qdrant/openapi-typescript-fetch/commit/a2120c3f5e22cd289760784a579bb1e50d7fd280) Thanks [@Rendez](https://github.com/Rendez)! - fix: parameters query optional in CreateFetch type

## 1.2.0

### Minor Changes

- - Package `type=module` compatibility and exports entrypoint for cjs, es6 and esm
  - Do not send `content-type` header with empty body
  - Fix strictness of parameters in the query in the creator function
  - Enable `FormData` as body
  - Support 202 Accepted response type
  - Infer types for OAS3 using `application/json; charset=utf-8`
