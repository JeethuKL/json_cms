import { z } from "zod";

export class ValidationError extends Error {
  constructor(message: string, public readonly errors: z.ZodIssue[]) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ValidationService {
  private schemas: Map<string, z.ZodType> = new Map();

  registerSchema(path: string, schema: z.ZodType): void {
    this.schemas.set(path, schema);
  }

  getSchema(path: string): z.ZodType | undefined {
    return this.schemas.get(path);
  }

  async validateJson(path: string, content: string): Promise<boolean> {
    try {
      // Parse JSON first
      const jsonData = JSON.parse(content);

      // Get schema for this file
      const schema = this.schemas.get(path);
      if (!schema) {
        // If no schema exists, just validate that it's valid JSON
        return true;
      }

      // Validate against schema
      await schema.parseAsync(jsonData);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Schema validation failed", error.errors);
      }
      if (error instanceof SyntaxError) {
        throw new ValidationError("Invalid JSON", [{
          code: z.ZodIssueCode.custom,
          path: [],
          message: error.message
        }]);
      }
      throw error;
    }
  }

  static createDefaultSchema(): z.ZodType {
    return z.object({}).passthrough();
  }

  static createArraySchema(itemSchema: z.ZodType): z.ZodType {
    return z.array(itemSchema);
  }

  static createObjectSchema(shape: Record<string, z.ZodType>): z.ZodType {
    return z.object(shape).passthrough();
  }

  loadSchemaFromJson(schemaJson: string): z.ZodType {
    const schema = JSON.parse(schemaJson);
    return this.jsonSchemaToZod(schema);
  }

  private jsonSchemaToZod(schema: any): z.ZodType {
    if (!schema || typeof schema !== "object") {
      return z.any();
    }

    switch (schema.type) {
      case "string":
        let stringSchema = z.string();
        if (schema.minLength !== undefined) {
          stringSchema = stringSchema.min(schema.minLength);
        }
        if (schema.maxLength !== undefined) {
          stringSchema = stringSchema.max(schema.maxLength);
        }
        if (schema.pattern) {
          stringSchema = stringSchema.regex(new RegExp(schema.pattern));
        }
        return stringSchema;

      case "number":
        let numberSchema = z.number();
        if (schema.minimum !== undefined) {
          numberSchema = numberSchema.min(schema.minimum);
        }
        if (schema.maximum !== undefined) {
          numberSchema = numberSchema.max(schema.maximum);
        }
        return numberSchema;

      case "integer":
        let integerSchema = z.number().int();
        if (schema.minimum !== undefined) {
          integerSchema = integerSchema.min(schema.minimum);
        }
        if (schema.maximum !== undefined) {
          integerSchema = integerSchema.max(schema.maximum);
        }
        return integerSchema;

      case "boolean":
        return z.boolean();

      case "array":
        const itemSchema = schema.items 
          ? this.jsonSchemaToZod(schema.items)
          : z.any();
        let arraySchema = z.array(itemSchema);
        if (schema.minItems !== undefined) {
          arraySchema = arraySchema.min(schema.minItems);
        }
        if (schema.maxItems !== undefined) {
          arraySchema = arraySchema.max(schema.maxItems);
        }
        return arraySchema;

      case "object":
        const properties = schema.properties || {};
        const required = schema.required || [];
        const shape: Record<string, z.ZodType> = {};

        for (const [key, value] of Object.entries(properties)) {
          const propertySchema = this.jsonSchemaToZod(value);
          shape[key] = required.includes(key) 
            ? propertySchema 
            : propertySchema.optional();
        }

        return z.object(shape).passthrough();

      default:
        return z.any();
    }
  }
}
