// validation.js
const Joi = require('joi');

const askSchema = Joi.object({
  question: Joi.string().min(1).required(),
  model: Joi.string().optional(),
  chatBoxNumber: Joi.number().integer().min(1).required(),
  context: Joi.array()
    .items(
      Joi.object({
        user: Joi.string().required(),
        message: Joi.string().required(),
        timestamp: Joi.string().optional(),
        tokens: Joi.number().optional(),
      })
    )
    .optional(),
  system_prompt: Joi.string().optional().allow(''),
});

const getContextSchema = Joi.object({
  chatBoxNumbers: Joi.array().items(Joi.number().integer().min(1)).required(),
});

module.exports = {
  askSchema,
  getContextSchema
};
