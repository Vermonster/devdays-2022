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
