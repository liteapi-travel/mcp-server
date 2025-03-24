import Ajv from 'ajv';

const ajv = new Ajv();

export function validateSchema(schema: any) {
  const validate = ajv.compile(schema);
  return (data: any) => {
    const valid = validate(data);
    if (!valid) {
      throw new Error(JSON.stringify(validate.errors));
    }
    return true;
  };
}
