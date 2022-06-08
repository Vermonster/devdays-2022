# Exercise: Build $extract

## Make a minimial typescript project:

```
npm init
npm i --save-dev typescript
npx tsc init
```

Minimial tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "es2016" /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */,
    "module": "commonjs" /* Specify what module code is generated. */,
    "esModuleInterop": true /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */,
    "forceConsistentCasingInFileNames": true /* Ensure that casing is correct in imports. */,
    "strict": true /* Enable all strict type-checking options. */,
    "skipLibCheck": true /* Skip type checking all .d.ts files. */
  }
}
```

## Setup a server

Install [Fastify](https://www.fastify.io/)

```
npm install fastify @fastify/cors
```

Create server.ts:
```typescript
import fastify, { FastifyInstance, FastifyRequest } from 'fastify'
import fastifyCors from '@fastify/cors'

const server: FastifyInstance = fastify({
  logger: { prettyPrint: true }
})

server.register(fastifyCors, {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS']
})


const start = async () => {
  try {
    await server.listen(3000)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()

```

Update package.json:
```json
  "main": "server.ts",
  ...
  "scripts": {
    "build": "tsc",
    "start": "nodemon",
    "serve": "node -r ts-node/register server.ts"
  },
  "nodemonConfig": {
    "execMap": {
      "ts": "node --require ts-node/register/transpile-only"
    }
  },
  ...
```

Now you should be able to start with:
```
npm run start
```

---

## Create [extract operation endpoint](https://build.fhir.org/ig/HL7/sdc/OperationDefinition-QuestionnaireResponse-extract.html)

Add @types/fhir
```
npm i --save-dev @types/fhir
```

In server.ts, add:
```typescript
const isParameters = (resource: any): resource is fhir4.Parameters => {
  return resource?.resourceType === 'Parameters'
}

const isQuestionnaireResponse = (resource: any): resource is fhir4.QuestionnaireResponse => {
  return resource?.resourceType === 'QuestionnaireResponse'
}

const extract = (questionnaireResponse: fhir4.QuestionnaireResponse): fhir4.Bundle => {
  return {
    resourceType: 'Bundle'
  }
}

server.post(
  '/QuestionnaireResponse/$extract',
  async (req: FastifyRequest): Promise<fhir4.Bundle> => {
    const parameters = req.body
    if (isParameters(parameters)) {
      const questionnaireResponseParameter = parameters.parameter?.find(
        (p) => p.name === 'questionnaire-response'
      )
      const questionnaireResponse = questionnaireResponseParameter?.resource

      if (isQuestionnaireResponse(questionnaireResponse)) {
        return extract(questionnaireResponse)
      }
    }
    throw new Error('Invalid Request')
  }
)
```

Test with this fixture:
```json
{
    "resourceType": "Parameters",
    "parameter": [
        {
            "name": "questionnaire-response",
            "resource": {
                "resourceType": "QuestionnaireResponse",
                "status": "completed",
                "contained": [
                    {
                        "resourceType": "Questionnaire",
                        "status": "unknown",
                        "item": [
                            {
                                "linkId": "a",
                                "type": "boolean",
                                "code": [
                                    {
                                        "code": "1234"
                                    }
                                ]
                            },
                            {
                                "linkId": "b",
                                "text": "Hemoglobin A1C",
                                "type": "quantity",
                                "code": [
                                    {
                                        "system": "http://loinc.org",
                                        "code": "4548-4"
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "item": [
                    {
                        "linkId": "a",
                        "answer": [
                            {
                                "valueBoolean": true
                            },
                            {
                                "valueBoolean": false
                            }
                        ]
                    },
                    {
                        "linkId": "b",
                        "answer": [
                            {
                                "valueQuantity": {
                                    "value": 4,
                                    "unit": "%",
                                    "code": "%"
                                }
                            }
                        ]
                    }
                ]
            }
        }
    ]
}
```

---

## Implement extract functionality

Create a file `extract.ts`, move temp implementation from `server.ts` and export (add import to `server.ts`)

```typescript
export const extract = (questionnaireResponse: fhir4.QuestionnaireResponse): fhir4.Bundle => {
  return {
    resourceType: 'Bundle'
  }
}
```

Now we will walk through the implementation:

```typescript
import { v4 } from 'uuid'

export const extract = (
  questionnaireResponse: fhir4.QuestionnaireResponse
): fhir4.Bundle => {
  const questionnaire = containedQuestionnare(questionnaireResponse)
  let bundleEntries: fhir4.BundleEntry[] = []

  if (questionnaire) {
    const observations: fhir4.Observation[] =
      questionnaireResponse.item?.reduce<fhir4.Observation[]>((acc, qrItem) => {
        const qItem = questionnaireItemByLinkId(questionnaire, qrItem.linkId)
        if (qItem != null) {
          acc.push(...extractObservationFromQuestionnaireItem(qrItem, qItem))
        }
        return acc
      }, []) || []

    bundleEntries = observations?.map((observation) => {
      return {
        fullUrl: `uuid:${observation.id}`,
        resource: observation,
        request: {
          method: 'POST',
          url: '/Observation',
        },
      }
    })
  }

  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: bundleEntries,
  }
}

const containedQuestionnare = (
  resource: fhir4.DomainResource
): fhir4.Questionnaire | undefined => {
  return resource.contained?.find(isQuestionnare)
}

const isQuestionnare = (resource: any): resource is fhir4.Questionnaire => {
  return resource?.resourceType === 'Questionnaire'
}

const questionnaireItemByLinkId = (
  questionnaire: fhir4.Questionnaire | null,
  linkId: string
): fhir4.QuestionnaireItem | undefined => {
  return questionnaire?.item?.find((item) => item.linkId === linkId)
}

const extractObservationFromQuestionnaireItem = (
  questionnaireResponseItem: fhir4.QuestionnaireResponseItem,
  questionnaireItem: fhir4.QuestionnaireItem
): fhir4.Observation[] => {
  const coding: fhir4.Coding[] | undefined = questionnaireItem.code?.map(
    (c) => c
  )

  return (
    questionnaireResponseItem.answer
      ?.map<fhir4.Observation | undefined>((value) => {
        const valueType =
          mapQuestionnaireResponseAnswerToObservationValue(value)
        if (valueType !== undefined) {
          const observation: fhir4.Observation = {
            resourceType: 'Observation',
            id: v4(),
            status: 'final',
            code: { coding },
            ...valueType,
          }
          return observation
        }
      })
      .filter(isObservation) || []
  )
}

const isObservation = (resource: any): resource is fhir4.Observation => {
  return resource?.resourceType === 'Observation'
}

const mapQuestionnaireResponseAnswerToObservationValue = (
  questionnaireResponseItemAnswer: fhir4.QuestionnaireResponseItemAnswer
): ObservationValue | undefined => {
  const questionnaireType = questionnaireResponseItemAnswerTypes.find(
    (c) => questionnaireResponseItemAnswer[c] != null
  )

  switch (questionnaireType) {
    case 'valueBoolean':
      const valueBoolean = questionnaireResponseItemAnswer.valueBoolean
      if (valueBoolean != null) {
        return { valueBoolean }
      }

    case 'valueCoding':
      const valueCoding = questionnaireResponseItemAnswer.valueCoding
      if (valueCoding != null) {
        return { valueCodeableConcept: { coding: [valueCoding] } }
      }

    case 'valueDate':
      const valueDate = questionnaireResponseItemAnswer.valueDate
      if (valueDate != null) {
        return { valueDateTime: valueDate }
      }

    case 'valueDateTime':
      const valueDateTime = questionnaireResponseItemAnswer.valueDate
      if (valueDateTime != null) {
        return { valueDateTime }
      }

    case 'valueInteger':
      const valueInteger = questionnaireResponseItemAnswer.valueInteger
      if (valueInteger != null) {
        return { valueInteger }
      }

    case 'valueQuantity':
      const valueQuantity = questionnaireResponseItemAnswer.valueQuantity
      if (valueQuantity != null) {
        return { valueQuantity }
      }

    case 'valueString' || 'valueUri':
      const valueString =
        questionnaireResponseItemAnswer.valueString ||
        questionnaireResponseItemAnswer.valueUri
      if (valueString != null) {
        return { valueString }
      }

    case 'valueTime':
      const valueTime = questionnaireResponseItemAnswer.valueTime
      if (valueTime != null) {
        return { valueTime }
      }

    default:
      throw new Error(`Do not know how to map ${questionnaireType}`)
  }
}

const questionnaireResponseItemAnswerTypes = [
  'valueAttachment',
  'valueBoolean',
  'valueCoding',
  'valueDate',
  'valueDateTime',
  'valueDecimal',
  'valueInteger',
  'valueQuantity',
  'valueReference',
  'valueString',
  'valueTime',
  'valueUri',
] as const

interface ObservationValue {
  valueQuantity?: fhir4.Quantity | undefined
  valueCodeableConcept?: fhir4.CodeableConcept | undefined
  valueString?: string | undefined
  valueBoolean?: boolean | undefined
  valueInteger?: number | undefined
  valueRange?: fhir4.Range | undefined
  valueRatio?: fhir4.Ratio | undefined
  valueSampledData?: fhir4.SampledData | undefined
  valueTime?: string | undefined
  valueDateTime?: string | undefined
  valuePeriod?: fhir4.Period | undefined
}
```

