// Zod → JSON Schema 的最小转换器:只覆盖本项目动作输入用到的 Zod 子集
// (object/string/number/boolean/enum/literal/optional/default/nullable/array/union)。
// 目的是给 MCP tools/list 与 REST 动作目录生成 inputSchema,不追求全量兼容。

import { z } from "zod";

type JsonSchema = Record<string, unknown>;

export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  return convert(schema, new Set());
}

function convert(schema: z.ZodTypeAny, seen: Set<string>): JsonSchema {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      properties[k] = convert(v, seen);
      // Zod 语义:.optional() 与 .default() 都允许省略,不算 required
      if (!(v instanceof z.ZodOptional) && !(v instanceof z.ZodDefault)) required.push(k);
    }
    return withDescription({ type: "object", properties, ...(required.length ? { required } : {}) }, schema);
  }
  if (schema instanceof z.ZodString) {
    const checks = (schema._def as { checks?: Array<Record<string, unknown>> }).checks ?? [];
    const out: JsonSchema = { type: "string" };
    for (const c of checks) {
      if (c.kind === "min" && typeof c.value === "number") out.minLength = c.value;
      if (c.kind === "max" && typeof c.value === "number") out.maxLength = c.value;
    }
    return withDescription(out, schema);
  }
  if (schema instanceof z.ZodNumber) return withDescription({ type: "number" }, schema);
  if (schema instanceof z.ZodBoolean) return withDescription({ type: "boolean" }, schema);
  if (schema instanceof z.ZodEnum) {
    return withDescription({ type: "string", enum: schema._def.values }, schema);
  }
  if (schema instanceof z.ZodLiteral) {
    return { const: schema._def.value, ...(typeof schema._def.value === "string" ? { type: "string" } : {}) };
  }
  if (schema instanceof z.ZodArray) {
    return withDescription({ type: "array", items: convert(schema._def.type, seen) }, schema);
  }
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    const inner = convert(schema._def.innerType, seen);
    return schema instanceof z.ZodOptional ? inner : { ...inner, nullable: true, ...(!("type" in inner) && !("const" in inner) ? {} : {}) };
  }
  if (schema instanceof z.ZodDefault) {
    return withDescription({ ...convert(schema._def.innerType, seen), default: schema._def.defaultValue() }, schema);
  }
  if (schema instanceof z.ZodUnion) {
    return { anyOf: (schema._def.options as z.ZodTypeAny[]).map((o) => convert(o, seen)) };
  }
  if (schema instanceof z.ZodEffects || schema instanceof z.ZodPipeline) {
    return convert((schema._def as { schema?: z.ZodTypeAny; in?: z.ZodTypeAny }).schema ?? (schema._def as { in: z.ZodTypeAny }).in, seen);
  }
  return {};
}

function withDescription(out: JsonSchema, schema: z.ZodTypeAny): JsonSchema {
  const desc = schema.description;
  return desc ? { ...out, description: desc } : out;
}
