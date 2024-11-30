// schemas.js
const Joi = require('joi');

/**
 * Schema for validating ask endpoint requests
 */
const askSchema = Joi.object({
  question: Joi.string()
    .min(1)
    .required()
    .description('The question to be answered'),
    
  model: Joi.string()
    .optional()
    .description('The model to use for generating the response'),
    
  chatBoxNumber: Joi.number()
    .integer()
    .min(1)
    .required()
    .description('Unique identifier for the chat box'),
    
  context: Joi.array()
    .items(
      Joi.object({
        user: Joi.string().required().description('User identifier'),
        message: Joi.string().required().description('Message content'),
        timestamp: Joi.string().optional().description('Message timestamp'),
        tokens: Joi.number().optional().description('Token count'),
      })
    )
    .optional()
    .description('Previous conversation context'),
    
  system_prompt: Joi.string()
    .optional()
    .allow('')
    .description('System prompt to guide the model response'),
});

/**
 * Schema for validating get-context endpoint requests
 */
const getContextSchema = Joi.object({
  chatBoxNumbers: Joi.array()
    .items(
      Joi.number()
        .integer()
        .min(1)
        .description('Chat box identifier')
    )
    .required()
    .description('Array of chat box numbers to retrieve context for'),
});

module.exports = {
  askSchema,
  getContextSchema
};
