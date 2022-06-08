import fastify, { FastifyInstance, FastifyRequest } from 'fastify'
import fastifyCors from '@fastify/cors'
import { extract } from './extract'

const server: FastifyInstance = fastify({
  logger: { prettyPrint: true },
})

server.register(fastifyCors, {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
})

const isParameters = (resource: any): resource is fhir4.Parameters => {
  return resource?.resourceType === 'Parameters'
}

const isQuestionnaireResponse = (
  resource: any
): resource is fhir4.QuestionnaireResponse => {
  return resource?.resourceType === 'QuestionnaireResponse'
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

const start = async () => {
  try {
    await server.listen(3000)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
