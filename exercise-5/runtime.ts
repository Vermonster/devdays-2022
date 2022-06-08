import { create, Describe, literal, object, optional, string } from 'superstruct'

const Patient: Describe<fhir4.Patient> = object({
  resourceType: literal('Patient'),
  birthDate: optional(string())
})

const myPatient = create({
  birthDate: '2022-01-01'
}, Patient)

console.log(myPatient.birthDate)

