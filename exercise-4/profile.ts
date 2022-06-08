
interface MyPatient extends fhir4.Patient {
  name: [ fhir4.HumanName ]
}

const basePatient: fhir4.Patient = {
  resourceType: 'Patient'
}

const myPatient: MyPatient = {
  resourceType: 'Patient',
  /*
  name: [
    {
      text: 'Joe Smith'
    }
  ]
  */
}

