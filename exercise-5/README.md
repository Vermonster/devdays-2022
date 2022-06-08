# Runtime typechecking

As typescript compiles to JS/ES, there is no type checking at runtime.

There is some level of checking with type guards.

Options include:

* Use FHIR JSON Schema
* TypeScript Runtime Data Validators (see: https://javascript.plainenglish.io/a-typescript-runtime-data-validators-comparison-50a6abf3c559)
  - io-ts
  - joi
  - yup
  - ajv
  - zod
  - superstruct
* Example here with Superstruct https://docs.superstructjs.org/
