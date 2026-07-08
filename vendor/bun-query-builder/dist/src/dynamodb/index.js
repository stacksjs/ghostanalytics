// @bun
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = import.meta.require;

// src/drivers/dynamodb.ts
class DynamoDBDriverImpl {
  config;
  entityMappings = new Map;
  constructor(config) {
    this.config = config;
    if (config.entityMappings) {
      for (const mapping of config.entityMappings) {
        this.registerEntity(mapping);
      }
    }
  }
  createTable(definition) {
    return {
      ...definition,
      billingMode: definition.billingMode ?? this.config.defaultBillingMode ?? "PAY_PER_REQUEST"
    };
  }
  deleteTable(tableName) {
    return { tableName };
  }
  registerEntity(mapping) {
    this.entityMappings.set(mapping.entityType, mapping);
  }
  getEntityMapping(entityType) {
    return this.entityMappings.get(entityType);
  }
  buildPrimaryKey(entityType, values) {
    const mapping = this.entityMappings.get(entityType);
    if (!mapping) {
      throw new Error(`No entity mapping found for type: ${entityType}`);
    }
    const pk = this.interpolatePattern(mapping.pkPattern, values);
    const sk = this.interpolatePattern(mapping.skPattern, values);
    return { pk, sk };
  }
  parseEntityFromItem(item) {
    const pk = item.pk || item.PK;
    if (!pk)
      return null;
    for (const [entityType, mapping] of this.entityMappings) {
      const prefix = mapping.pkPattern.split("${")[0];
      if (pk.startsWith(prefix)) {
        return {
          entityType,
          data: this.unmarshall(item)
        };
      }
    }
    return null;
  }
  buildQueryParams(params) {
    return {
      tableName: params.tableName ?? this.config.tableName ?? "",
      keyConditions: params.keyConditions ?? [],
      ...params
    };
  }
  buildScanParams(params) {
    return {
      tableName: params.tableName ?? this.config.tableName ?? "",
      ...params
    };
  }
  buildGetItemParams(params) {
    return {
      tableName: params.tableName ?? this.config.tableName ?? "",
      key: params.key ?? {},
      ...params
    };
  }
  buildPutItemParams(params) {
    return {
      tableName: params.tableName ?? this.config.tableName ?? "",
      item: params.item ?? {},
      ...params
    };
  }
  buildUpdateItemParams(params) {
    return {
      tableName: params.tableName ?? this.config.tableName ?? "",
      key: params.key ?? {},
      updateExpressions: params.updateExpressions ?? {},
      ...params
    };
  }
  buildDeleteItemParams(params) {
    return {
      tableName: params.tableName ?? this.config.tableName ?? "",
      key: params.key ?? {},
      ...params
    };
  }
  buildBatchGetItemParams(params) {
    return {
      requestItems: params.requestItems ?? {}
    };
  }
  buildBatchWriteItemParams(params) {
    return {
      requestItems: params.requestItems ?? {}
    };
  }
  buildTransactWriteParams(params) {
    return {
      transactItems: params.transactItems ?? [],
      ...params
    };
  }
  buildKeyConditionExpression(conditions) {
    return this.buildExpression(conditions, "AND");
  }
  buildFilterExpression(conditions) {
    return this.buildExpression(conditions, "AND");
  }
  buildUpdateExpression(updates) {
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    const parts = [];
    let valueIndex = 0;
    if (updates.set && Object.keys(updates.set).length > 0) {
      const setParts = [];
      for (const [key, value] of Object.entries(updates.set)) {
        const nameKey = `#attr${valueIndex}`;
        const valueKey = `:val${valueIndex}`;
        expressionAttributeNames[nameKey] = key;
        expressionAttributeValues[valueKey] = this.marshallValue(value);
        setParts.push(`${nameKey} = ${valueKey}`);
        valueIndex++;
      }
      parts.push(`SET ${setParts.join(", ")}`);
    }
    if (updates.remove && updates.remove.length > 0) {
      const removeParts = [];
      for (const attr of updates.remove) {
        const nameKey = `#attr${valueIndex}`;
        expressionAttributeNames[nameKey] = attr;
        removeParts.push(nameKey);
        valueIndex++;
      }
      parts.push(`REMOVE ${removeParts.join(", ")}`);
    }
    if (updates.add && Object.keys(updates.add).length > 0) {
      const addParts = [];
      for (const [key, value] of Object.entries(updates.add)) {
        const nameKey = `#attr${valueIndex}`;
        const valueKey = `:val${valueIndex}`;
        expressionAttributeNames[nameKey] = key;
        expressionAttributeValues[valueKey] = this.marshallValue(value);
        addParts.push(`${nameKey} ${valueKey}`);
        valueIndex++;
      }
      parts.push(`ADD ${addParts.join(", ")}`);
    }
    if (updates.delete && Object.keys(updates.delete).length > 0) {
      const deleteParts = [];
      for (const [key, value] of Object.entries(updates.delete)) {
        const nameKey = `#attr${valueIndex}`;
        const valueKey = `:val${valueIndex}`;
        expressionAttributeNames[nameKey] = key;
        expressionAttributeValues[valueKey] = this.marshallValue(value);
        deleteParts.push(`${nameKey} ${valueKey}`);
        valueIndex++;
      }
      parts.push(`DELETE ${deleteParts.join(", ")}`);
    }
    return {
      expression: parts.join(" "),
      expressionAttributeNames,
      expressionAttributeValues
    };
  }
  buildProjectionExpression(attributes) {
    const expressionAttributeNames = {};
    const projectionParts = [];
    attributes.forEach((attr, index) => {
      const nameKey = `#proj${index}`;
      expressionAttributeNames[nameKey] = attr;
      projectionParts.push(nameKey);
    });
    return {
      expression: projectionParts.join(", "),
      expressionAttributeNames
    };
  }
  marshall(item) {
    const result = {};
    for (const [key, value] of Object.entries(item)) {
      result[key] = this.marshallValue(value);
    }
    return result;
  }
  unmarshall(item) {
    const result = {};
    for (const [key, value] of Object.entries(item)) {
      result[key] = this.unmarshallValue(value);
    }
    return result;
  }
  interpolatePattern(pattern, values) {
    return pattern.replace(/\$\{(\w+)\}/g, (_, key) => {
      if (!(key in values)) {
        throw new Error(`Missing value for pattern key: ${key}`);
      }
      return String(values[key]);
    });
  }
  buildExpression(conditions, joiner) {
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    const parts = [];
    conditions.forEach((condition, index) => {
      const nameKey = `#attr${index}`;
      expressionAttributeNames[nameKey] = condition.attribute;
      let expr;
      switch (condition.operator) {
        case "=":
        case "<":
        case "<=":
        case ">":
        case ">=": {
          const valueKey = `:val${index}`;
          expressionAttributeValues[valueKey] = this.marshallValue(condition.value);
          expr = `${nameKey} ${condition.operator} ${valueKey}`;
          break;
        }
        case "BETWEEN": {
          const valueKey1 = `:val${index}a`;
          const valueKey2 = `:val${index}b`;
          expressionAttributeValues[valueKey1] = this.marshallValue(condition.values?.[0]);
          expressionAttributeValues[valueKey2] = this.marshallValue(condition.values?.[1]);
          expr = `${nameKey} BETWEEN ${valueKey1} AND ${valueKey2}`;
          break;
        }
        case "begins_with": {
          const valueKey = `:val${index}`;
          expressionAttributeValues[valueKey] = this.marshallValue(condition.value);
          expr = `begins_with(${nameKey}, ${valueKey})`;
          break;
        }
        case "contains": {
          const valueKey = `:val${index}`;
          expressionAttributeValues[valueKey] = this.marshallValue(condition.value);
          expr = `contains(${nameKey}, ${valueKey})`;
          break;
        }
        case "attribute_exists":
          expr = `attribute_exists(${nameKey})`;
          break;
        case "attribute_not_exists":
          expr = `attribute_not_exists(${nameKey})`;
          break;
        case "attribute_type": {
          const valueKey = `:val${index}`;
          expressionAttributeValues[valueKey] = { S: condition.value };
          expr = `attribute_type(${nameKey}, ${valueKey})`;
          break;
        }
        case "IN": {
          const valueKeys = (condition.values ?? []).map((_, i) => `:val${index}_${i}`);
          condition.values?.forEach((val, i) => {
            expressionAttributeValues[`:val${index}_${i}`] = this.marshallValue(val);
          });
          expr = `${nameKey} IN (${valueKeys.join(", ")})`;
          break;
        }
        default:
          throw new Error(`Unknown operator: ${condition.operator}`);
      }
      parts.push(expr);
    });
    return {
      expression: parts.join(` ${joiner} `),
      expressionAttributeNames,
      expressionAttributeValues
    };
  }
  marshallValue(value) {
    if (value === null || value === undefined) {
      return { NULL: true };
    }
    if (typeof value === "string") {
      return { S: value };
    }
    if (typeof value === "number") {
      return { N: String(value) };
    }
    if (typeof value === "boolean") {
      return { BOOL: value };
    }
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      return { B: value };
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { L: [] };
      }
      const _firstType = typeof value[0];
      const isStringSet = value.every((v) => typeof v === "string");
      const isNumberSet = value.every((v) => typeof v === "number");
      if (isStringSet) {
        return { SS: value };
      }
      if (isNumberSet) {
        return { NS: value.map(String) };
      }
      return { L: value.map((v) => this.marshallValue(v)) };
    }
    if (typeof value === "object") {
      const marshalled = {};
      for (const [k, v] of Object.entries(value)) {
        marshalled[k] = this.marshallValue(v);
      }
      return { M: marshalled };
    }
    return { S: String(value) };
  }
  unmarshallValue(value) {
    if (!value || typeof value !== "object") {
      return value;
    }
    if ("S" in value)
      return value.S;
    if ("N" in value)
      return Number(value.N);
    if ("BOOL" in value)
      return value.BOOL;
    if ("NULL" in value)
      return null;
    if ("B" in value)
      return value.B;
    if ("SS" in value)
      return value.SS;
    if ("NS" in value)
      return value.NS.map(Number);
    if ("BS" in value)
      return value.BS;
    if ("L" in value)
      return value.L.map((v) => this.unmarshallValue(v));
    if ("M" in value) {
      const result = {};
      for (const [k, v] of Object.entries(value.M)) {
        result[k] = this.unmarshallValue(v);
      }
      return result;
    }
    return value;
  }
}
function createDynamoDBDriver(config) {
  return new DynamoDBDriverImpl(config);
}

// src/dynamodb/client.ts
async function hmacSha256(key, message) {
  const keyBuffer = key instanceof ArrayBuffer ? key : key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}
async function sha256(message) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}
async function signRequest(method, url, headers, body, credentials, region, service) {
  const now = new Date;
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = url.pathname;
  const canonicalQuerystring = url.search.slice(1);
  const signedHeaders = {
    ...headers,
    host: url.host,
    "x-amz-date": amzDate
  };
  if (credentials.sessionToken) {
    signedHeaders["x-amz-security-token"] = credentials.sessionToken;
  }
  const sortedHeaderKeys = Object.keys(signedHeaders).sort();
  const canonicalHeaders = sortedHeaderKeys.map((key) => `${key.toLowerCase()}:${signedHeaders[key].trim()}`).join(`
`) + `
`;
  const signedHeadersStr = sortedHeaderKeys.map((k) => k.toLowerCase()).join(";");
  const payloadHash = await sha256(body);
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeadersStr,
    payloadHash
  ].join(`
`);
  const canonicalRequestHash = await sha256(canonicalRequest);
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join(`
`);
  const signingKey = await getSigningKey(credentials.secretAccessKey, dateStamp, region, service);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const authorization = `${algorithm} Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;
  return {
    ...signedHeaders,
    authorization
  };
}

class DynamoDBClient {
  config;
  endpoint;
  credentials;
  constructor(config) {
    this.config = config;
    this.endpoint = config.endpoint ?? `https://dynamodb.${config.region}.amazonaws.com`;
    this.credentials = config.credentials ?? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      sessionToken: process.env.AWS_SESSION_TOKEN
    };
    if (!this.credentials.accessKeyId || !this.credentials.secretAccessKey) {
      throw new Error("AWS credentials not provided. Set credentials in config or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables.");
    }
  }
  async execute(operation, input) {
    const url = new URL(this.endpoint);
    const body = JSON.stringify(input);
    const headers = {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target": `DynamoDB_20120810.${operation}`
    };
    const signedHeaders = await signRequest("POST", url, headers, body, this.credentials, this.config.region, "dynamodb");
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: signedHeaders,
      body
    });
    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.message ?? errorJson.Message ?? errorBody;
      } catch {
        errorMessage = errorBody;
      }
      throw new Error(`DynamoDB ${operation} failed: ${response.status} - ${errorMessage}`);
    }
    return response.json();
  }
  async query(input) {
    return this.execute("Query", input);
  }
  async scan(input) {
    return this.execute("Scan", input);
  }
  async getItem(input) {
    return this.execute("GetItem", input);
  }
  async putItem(input) {
    return this.execute("PutItem", input);
  }
  async updateItem(input) {
    return this.execute("UpdateItem", input);
  }
  async deleteItem(input) {
    return this.execute("DeleteItem", input);
  }
  async batchGetItem(input) {
    return this.execute("BatchGetItem", input);
  }
  async batchWriteItem(input) {
    return this.execute("BatchWriteItem", input);
  }
  async transactWriteItems(input) {
    return this.execute("TransactWriteItems", input);
  }
  async describeTable(tableName) {
    return this.execute("DescribeTable", { TableName: tableName });
  }
  async createTable(input) {
    return this.execute("CreateTable", input);
  }
  async deleteTable(tableName) {
    return this.execute("DeleteTable", { TableName: tableName });
  }
  async listTables(input) {
    return this.execute("ListTables", input ?? {});
  }
  async updateTable(input) {
    return this.execute("UpdateTable", input);
  }
  async updateTimeToLive(input) {
    return this.execute("UpdateTimeToLive", input);
  }
  async describeTimeToLive(tableName) {
    return this.execute("DescribeTimeToLive", { TableName: tableName });
  }
}
function createClient(config) {
  return new DynamoDBClient(config);
}

// src/dynamodb/model.ts
function configureModels(config) {
  globalConfig = { ...globalConfig, ...config };
  globalClient = null;
  globalDriver = null;
}
function getClient() {
  if (!globalClient) {
    globalClient = createClient({
      region: globalConfig.region ?? "us-east-1",
      endpoint: globalConfig.endpoint,
      credentials: globalConfig.credentials
    });
  }
  return globalClient;
}
function getDriver() {
  if (!globalDriver) {
    globalDriver = createDynamoDBDriver({
      region: globalConfig.region ?? "us-east-1",
      endpoint: globalConfig.endpoint,
      credentials: globalConfig.credentials
    });
  }
  return globalDriver;
}

class Model {
  static tableName = "";
  static pkAttribute = "pk";
  static skAttribute = "sk";
  static pkPrefix = "";
  static skPrefix = "METADATA";
  static entityTypeAttribute = "_et";
  static keyDelimiter = "#";
  static primaryKey = "id";
  static timestamps = true;
  static createdAtField = "createdAt";
  static updatedAtField = "updatedAt";
  _attributes = {};
  _original = {};
  _exists = false;
  constructor(attributes = {}) {
    this._attributes = { ...attributes };
    this._original = { ...attributes };
    for (const [key, value] of Object.entries(attributes)) {
      this[key] = value;
    }
  }
  static query() {
    return new ModelQueryBuilderImpl(this);
  }
  static async find(id) {
    const ModelClass = this;
    const client = getClient();
    const driver = getDriver();
    const pk = `${ModelClass.pkPrefix}${ModelClass.keyDelimiter}${id}`;
    const sk = ModelClass.skPrefix;
    try {
      const result = await client.getItem({
        TableName: ModelClass.tableName,
        Key: driver.marshall({
          [ModelClass.pkAttribute]: pk,
          [ModelClass.skAttribute]: sk
        })
      });
      if (!result.Item) {
        return null;
      }
      const data = driver.unmarshall(result.Item);
      const instance = new ModelClass(data);
      instance._exists = true;
      return instance;
    } catch (error) {
      console.error("Find error:", error);
      return null;
    }
  }
  static async findOrFail(id) {
    const result = await this.find(id);
    if (!result) {
      throw new Error(`${this.name} not found with id: ${id}`);
    }
    return result;
  }
  static async all() {
    return this.query().get();
  }
  static async create(attributes) {
    const ModelClass = this;
    const client = getClient();
    const driver = getDriver();
    const id = attributes[ModelClass.primaryKey];
    if (!id) {
      throw new Error(`${ModelClass.primaryKey} is required`);
    }
    const pk = `${ModelClass.pkPrefix}${ModelClass.keyDelimiter}${id}`;
    const sk = ModelClass.skPrefix;
    const now = new Date().toISOString();
    const item = {
      ...attributes,
      [ModelClass.pkAttribute]: pk,
      [ModelClass.skAttribute]: sk,
      [ModelClass.entityTypeAttribute]: ModelClass.name
    };
    if (ModelClass.timestamps) {
      item[ModelClass.createdAtField] = now;
      item[ModelClass.updatedAtField] = now;
    }
    await client.putItem({
      TableName: ModelClass.tableName,
      Item: driver.marshall(item),
      ConditionExpression: `attribute_not_exists(${ModelClass.pkAttribute})`
    });
    const instance = new ModelClass(item);
    instance._exists = true;
    return instance;
  }
  static async updateOrCreate(attributes, values) {
    const ModelClass = this;
    const id = attributes[ModelClass.primaryKey];
    const existing = await ModelClass.find(id);
    if (existing) {
      await existing.update(values);
      return existing;
    }
    return ModelClass.create({ ...attributes, ...values });
  }
  static where(attribute, operatorOrValue, value) {
    const builder = this.query();
    return builder.where(attribute, operatorOrValue, value);
  }
  static wherePk(value) {
    const builder = this.query();
    return builder.wherePk(value);
  }
  getKey() {
    const ModelClass = this.constructor;
    return this[ModelClass.primaryKey];
  }
  getAttribute(key) {
    return this._attributes[key];
  }
  setAttribute(key, value) {
    this._attributes[key] = value;
    this[key] = value;
    return this;
  }
  getAttributes() {
    return { ...this._attributes };
  }
  isDirty(attribute) {
    if (attribute) {
      return this._attributes[attribute] !== this._original[attribute];
    }
    return JSON.stringify(this._attributes) !== JSON.stringify(this._original);
  }
  getDirty() {
    const dirty = {};
    for (const [key, value] of Object.entries(this._attributes)) {
      if (value !== this._original[key]) {
        dirty[key] = value;
      }
    }
    return dirty;
  }
  async save() {
    if (this._exists) {
      const dirty = this.getDirty();
      if (Object.keys(dirty).length > 0) {
        await this.update(dirty);
      }
    } else {
      const ModelClass = this.constructor;
      const created = await ModelClass.create(this._attributes);
      this._attributes = created._attributes;
      this._original = { ...this._attributes };
      this._exists = true;
    }
    return this;
  }
  async update(values) {
    const ModelClass = this.constructor;
    const client = getClient();
    const driver = getDriver();
    const id = this.getKey();
    const pk = `${ModelClass.pkPrefix}${ModelClass.keyDelimiter}${id}`;
    const sk = ModelClass.skPrefix;
    const now = new Date().toISOString();
    const updateValues = { ...values };
    if (ModelClass.timestamps) {
      updateValues[ModelClass.updatedAtField] = now;
    }
    const setParts = [];
    const exprNames = {};
    const exprValues = {};
    let idx = 0;
    for (const [attr, value] of Object.entries(updateValues)) {
      const nameKey = `#attr${idx}`;
      const valueKey = `:val${idx}`;
      exprNames[nameKey] = attr;
      exprValues[valueKey] = driver.marshall({ v: value }).v;
      setParts.push(`${nameKey} = ${valueKey}`);
      idx++;
    }
    await client.updateItem({
      TableName: ModelClass.tableName,
      Key: driver.marshall({
        [ModelClass.pkAttribute]: pk,
        [ModelClass.skAttribute]: sk
      }),
      UpdateExpression: `SET ${setParts.join(", ")}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues
    });
    for (const [key, value] of Object.entries(updateValues)) {
      this._attributes[key] = value;
      this[key] = value;
    }
    this._original = { ...this._attributes };
    return this;
  }
  async delete() {
    const ModelClass = this.constructor;
    const client = getClient();
    const driver = getDriver();
    const id = this.getKey();
    const pk = `${ModelClass.pkPrefix}${ModelClass.keyDelimiter}${id}`;
    const sk = ModelClass.skPrefix;
    await client.deleteItem({
      TableName: ModelClass.tableName,
      Key: driver.marshall({
        [ModelClass.pkAttribute]: pk,
        [ModelClass.skAttribute]: sk
      })
    });
    this._exists = false;
    return true;
  }
  async refresh() {
    const ModelClass = this.constructor;
    const fresh = await ModelClass.find(this.getKey());
    if (fresh) {
      this._attributes = fresh._attributes;
      this._original = { ...this._attributes };
      for (const [key, value] of Object.entries(this._attributes)) {
        this[key] = value;
      }
    }
    return this;
  }
  toObject() {
    const ModelClass = this.constructor;
    const obj = { ...this._attributes };
    delete obj[ModelClass.pkAttribute];
    delete obj[ModelClass.skAttribute];
    delete obj[ModelClass.entityTypeAttribute];
    return obj;
  }
  toJSON() {
    return this.toObject();
  }
}

class ModelQueryBuilderImpl {
  ModelClass;
  _pkValue;
  _skCondition;
  _indexName;
  _filterConditions = [];
  _projectionAttrs = [];
  _limitValue;
  _scanForward = true;
  _consistentReadValue = false;
  _startKey;
  constructor(ModelClass) {
    this.ModelClass = ModelClass;
  }
  wherePk(value) {
    this._pkValue = `${this.ModelClass.pkPrefix}${this.ModelClass.keyDelimiter}${value}`;
    return this;
  }
  where(attribute, operatorOrValue, value) {
    if (value === undefined) {
      this._filterConditions.push({ attribute, operator: "=", value: operatorOrValue });
    } else {
      this._filterConditions.push({ attribute, operator: operatorOrValue, value });
    }
    return this;
  }
  whereIn(attribute, values) {
    this._filterConditions.push({ attribute, operator: "IN", values });
    return this;
  }
  whereBetween(attribute, start, end) {
    this._filterConditions.push({ attribute, operator: "BETWEEN", value: start, values: [start, end] });
    return this;
  }
  whereBeginsWith(attribute, prefix) {
    this._filterConditions.push({ attribute, operator: "begins_with", value: prefix });
    return this;
  }
  whereExists(attribute) {
    this._filterConditions.push({ attribute, operator: "attribute_exists" });
    return this;
  }
  whereNotExists(attribute) {
    this._filterConditions.push({ attribute, operator: "attribute_not_exists" });
    return this;
  }
  orderBy(direction) {
    this._scanForward = direction === "asc";
    return this;
  }
  limit(count) {
    this._limitValue = count;
    return this;
  }
  select(...attributes) {
    this._projectionAttrs.push(...attributes);
    return this;
  }
  index(indexName) {
    this._indexName = indexName;
    return this;
  }
  consistentRead() {
    this._consistentReadValue = true;
    return this;
  }
  startFrom(key) {
    this._startKey = key;
    return this;
  }
  buildRequest() {
    const driver = getDriver();
    const request = {
      TableName: this.ModelClass.tableName
    };
    if (this._indexName) {
      request.IndexName = this._indexName;
    }
    const exprNames = {};
    const exprValues = {};
    let idx = 0;
    const keyConditions = [];
    if (this._pkValue) {
      const nameKey = `#pk${idx}`;
      const valueKey = `:pk${idx}`;
      exprNames[nameKey] = this.ModelClass.pkAttribute;
      exprValues[valueKey] = { S: this._pkValue };
      keyConditions.push(`${nameKey} = ${valueKey}`);
      idx++;
    }
    if (this._skCondition) {
      const nameKey = `#sk${idx}`;
      exprNames[nameKey] = this.ModelClass.skAttribute;
      switch (this._skCondition.type) {
        case "eq": {
          const valueKey = `:sk${idx}`;
          exprValues[valueKey] = { S: this._skCondition.value };
          keyConditions.push(`${nameKey} = ${valueKey}`);
          break;
        }
        case "begins_with": {
          const valueKey = `:sk${idx}`;
          exprValues[valueKey] = { S: this._skCondition.value };
          keyConditions.push(`begins_with(${nameKey}, ${valueKey})`);
          break;
        }
      }
      idx++;
    }
    if (keyConditions.length > 0) {
      request.KeyConditionExpression = keyConditions.join(" AND ");
    }
    if (this._filterConditions.length > 0) {
      const filterParts = [];
      for (const cond of this._filterConditions) {
        const nameKey = `#flt${idx}`;
        exprNames[nameKey] = cond.attribute;
        if (cond.operator === "attribute_exists") {
          filterParts.push(`attribute_exists(${nameKey})`);
        } else if (cond.operator === "attribute_not_exists") {
          filterParts.push(`attribute_not_exists(${nameKey})`);
        } else if (cond.operator === "IN" && cond.values) {
          const valueKeys = cond.values.map((_, i) => `:flt${idx}_${i}`);
          cond.values.forEach((val, i) => {
            exprValues[`:flt${idx}_${i}`] = driver.marshall({ v: val }).v;
          });
          filterParts.push(`${nameKey} IN (${valueKeys.join(", ")})`);
        } else if (cond.operator === "BETWEEN" && cond.values) {
          const valueKey1 = `:flt${idx}a`;
          const valueKey2 = `:flt${idx}b`;
          exprValues[valueKey1] = driver.marshall({ v: cond.values[0] }).v;
          exprValues[valueKey2] = driver.marshall({ v: cond.values[1] }).v;
          filterParts.push(`${nameKey} BETWEEN ${valueKey1} AND ${valueKey2}`);
        } else if (cond.operator === "begins_with") {
          const valueKey = `:flt${idx}`;
          exprValues[valueKey] = driver.marshall({ v: cond.value }).v;
          filterParts.push(`begins_with(${nameKey}, ${valueKey})`);
        } else {
          const valueKey = `:flt${idx}`;
          exprValues[valueKey] = driver.marshall({ v: cond.value }).v;
          filterParts.push(`${nameKey} ${cond.operator} ${valueKey}`);
        }
        idx++;
      }
      request.FilterExpression = filterParts.join(" AND ");
    }
    if (this._projectionAttrs.length > 0) {
      const projParts = [];
      for (const attr of this._projectionAttrs) {
        const nameKey = `#proj${idx}`;
        exprNames[nameKey] = attr;
        projParts.push(nameKey);
        idx++;
      }
      request.ProjectionExpression = projParts.join(", ");
    }
    if (Object.keys(exprNames).length > 0) {
      request.ExpressionAttributeNames = exprNames;
    }
    if (Object.keys(exprValues).length > 0) {
      request.ExpressionAttributeValues = exprValues;
    }
    if (this._limitValue !== undefined) {
      request.Limit = this._limitValue;
    }
    request.ScanIndexForward = this._scanForward;
    if (this._consistentReadValue) {
      request.ConsistentRead = true;
    }
    if (this._startKey) {
      request.ExclusiveStartKey = driver.marshall(this._startKey);
    }
    return request;
  }
  async get() {
    const client = getClient();
    const driver = getDriver();
    const request = this.buildRequest();
    const isQuery = this._pkValue !== undefined;
    const response = isQuery ? await client.query(request) : await client.scan(request);
    const items = (response.Items ?? []).map((item) => {
      const data = driver.unmarshall(item);
      const instance = new this.ModelClass(data);
      instance._exists = true;
      return instance;
    });
    return items;
  }
  async first() {
    this._limitValue = 1;
    const results = await this.get();
    return results[0] ?? null;
  }
  async count() {
    const client = getClient();
    const request = this.buildRequest();
    request.Select = "COUNT";
    const isQuery = this._pkValue !== undefined;
    const response = isQuery ? await client.query(request) : await client.scan(request);
    return response.Count ?? 0;
  }
  async paginate(pageSize, lastKey) {
    const driver = getDriver();
    if (lastKey) {
      this._startKey = lastKey;
    }
    this._limitValue = pageSize;
    const client = getClient();
    const request = this.buildRequest();
    const isQuery = this._pkValue !== undefined;
    const response = isQuery ? await client.query(request) : await client.scan(request);
    const items = (response.Items ?? []).map((item) => {
      const data = driver.unmarshall(item);
      const instance = new this.ModelClass(data);
      instance._exists = true;
      return instance;
    });
    return {
      items,
      lastKey: response.LastEvaluatedKey ? driver.unmarshall(response.LastEvaluatedKey) : undefined
    };
  }
}
var globalConfig, globalClient = null, globalDriver = null;
var init_model = __esm(() => {
  globalConfig = {
    region: process.env.AWS_REGION ?? "us-east-1"
  };
});

// src/dynamodb/migrations.ts
function hashTableDefinition(definition) {
  const normalized = JSON.stringify({
    tableName: definition.tableName,
    keySchema: definition.keySchema,
    attributeDefinitions: [...definition.attributeDefinitions || []].sort((a, b) => a.name.localeCompare(b.name)),
    globalSecondaryIndexes: [...definition.globalSecondaryIndexes || []].sort((a, b) => a.indexName.localeCompare(b.indexName)),
    localSecondaryIndexes: [...definition.localSecondaryIndexes || []].sort((a, b) => a.indexName.localeCompare(b.indexName)),
    billingMode: definition.billingMode,
    ttlAttribute: definition.ttlAttribute,
    streamSpecification: definition.streamSpecification
  });
  let hash = 0;
  for (let i = 0;i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
function extractTableDefinition(model) {
  const schema = extractModelSchema(model);
  return convertSchemaToDefinition(schema);
}
function extractModelSchema(ModelClass) {
  return {
    tableName: ModelClass.tableName || "",
    pkAttribute: ModelClass.pkAttribute || "pk",
    skAttribute: ModelClass.skAttribute || "sk",
    pkPrefix: ModelClass.pkPrefix || "",
    skPrefix: ModelClass.skPrefix || "METADATA",
    entityTypeAttribute: ModelClass.entityTypeAttribute || "_et",
    timestamps: ModelClass.timestamps !== false,
    ttlAttribute: ModelClass.ttlAttribute,
    gsis: ModelClass.gsis,
    lsis: ModelClass.lsis,
    billingMode: ModelClass.billingMode || "PAY_PER_REQUEST",
    provisionedThroughput: ModelClass.provisionedThroughput,
    streamEnabled: ModelClass.streamEnabled,
    streamViewType: ModelClass.streamViewType
  };
}
function convertSchemaToDefinition(schema) {
  const attributeDefinitions = [
    { name: schema.pkAttribute, type: "S" },
    { name: schema.skAttribute, type: "S" }
  ];
  const gsis = [];
  if (schema.gsis) {
    for (const gsi of schema.gsis) {
      if (!attributeDefinitions.some((a) => a.name === gsi.pkAttribute)) {
        attributeDefinitions.push({ name: gsi.pkAttribute, type: "S" });
      }
      if (gsi.skAttribute && !attributeDefinitions.some((a) => a.name === gsi.skAttribute)) {
        attributeDefinitions.push({ name: gsi.skAttribute, type: "S" });
      }
      gsis.push({
        indexName: gsi.indexName,
        keySchema: {
          partitionKey: gsi.pkAttribute,
          sortKey: gsi.skAttribute
        },
        projection: {
          type: Array.isArray(gsi.projection) ? "INCLUDE" : gsi.projection || "ALL",
          nonKeyAttributes: Array.isArray(gsi.projection) ? gsi.projection : undefined
        },
        provisionedThroughput: gsi.provisionedThroughput
      });
    }
  }
  return {
    tableName: schema.tableName,
    keySchema: {
      partitionKey: schema.pkAttribute,
      sortKey: schema.skAttribute
    },
    attributeDefinitions,
    globalSecondaryIndexes: gsis.length > 0 ? gsis : undefined,
    billingMode: schema.billingMode,
    provisionedThroughput: schema.provisionedThroughput,
    ttlAttribute: schema.ttlAttribute,
    streamSpecification: schema.streamEnabled ? { enabled: true, viewType: schema.streamViewType || "NEW_AND_OLD_IMAGES" } : undefined
  };
}
function buildMigrationPlan(current, target) {
  const operations = [];
  const tableName = target.tableName;
  if (!current) {
    operations.push({
      type: "CREATE_TABLE",
      tableName,
      details: { definition: target }
    });
  } else {
    const pkChanged = current.keySchema.partitionKey !== target.keySchema.partitionKey;
    const skChanged = current.keySchema.sortKey !== target.keySchema.sortKey;
    if (pkChanged || skChanged) {
      console.warn(`[Migration] Table ${tableName}: Key schema changes require table recreation. ` + `Current: pk=${current.keySchema.partitionKey}, sk=${current.keySchema.sortKey}. ` + `Target: pk=${target.keySchema.partitionKey}, sk=${target.keySchema.sortKey}. ` + `This operation is not supported automatically.`);
    }
    const currentGSIs = current.globalSecondaryIndexes || [];
    const targetGSIs = target.globalSecondaryIndexes || [];
    const currentGSINames = new Set(currentGSIs.map((g) => g.indexName));
    const targetGSINames = new Set(targetGSIs.map((g) => g.indexName));
    for (const gsi of targetGSIs) {
      if (!currentGSINames.has(gsi.indexName)) {
        operations.push({
          type: "ADD_GSI",
          tableName,
          details: { gsi }
        });
      }
    }
    for (const gsi of currentGSIs) {
      if (!targetGSINames.has(gsi.indexName)) {
        operations.push({
          type: "DELETE_GSI",
          tableName,
          details: { indexName: gsi.indexName }
        });
      }
    }
    if (current.billingMode !== target.billingMode && target.billingMode) {
      operations.push({
        type: "UPDATE_BILLING_MODE",
        tableName,
        details: {
          billingMode: target.billingMode,
          provisionedThroughput: target.provisionedThroughput
        }
      });
    }
    if (current.ttlAttribute !== target.ttlAttribute) {
      operations.push({
        type: "UPDATE_TTL",
        tableName,
        details: {
          ttlAttribute: target.ttlAttribute || null,
          enabled: !!target.ttlAttribute
        }
      });
    }
    const currentStreamEnabled = current.streamSpecification?.enabled;
    const targetStreamEnabled = target.streamSpecification?.enabled;
    if (currentStreamEnabled !== targetStreamEnabled) {
      if (targetStreamEnabled) {
        operations.push({
          type: "ENABLE_STREAM",
          tableName,
          details: {
            viewType: target.streamSpecification?.viewType || "NEW_AND_OLD_IMAGES"
          }
        });
      } else {
        operations.push({
          type: "DISABLE_STREAM",
          tableName,
          details: {}
        });
      }
    }
  }
  return {
    tableName,
    operations,
    timestamp: new Date().toISOString(),
    hash: hashTableDefinition(target)
  };
}
function isDefinitionEqual(a, b) {
  return hashTableDefinition(a) === hashTableDefinition(b);
}

// src/dynamodb/migration-tracker.ts
class DynamoDBMigrationTracker {
  client;
  initialized = false;
  constructor(client) {
    this.client = client;
  }
  async ensureMigrationsTable() {
    if (this.initialized)
      return;
    try {
      await this.client.describeTable(MIGRATIONS_TABLE);
      this.initialized = true;
    } catch (error) {
      if (error.message?.includes("ResourceNotFoundException") || error.message?.includes("not found")) {
        console.log(`[Migration] Creating migrations table: ${MIGRATIONS_TABLE}`);
        await this.client.createTable({
          TableName: MIGRATIONS_TABLE,
          KeySchema: [
            { AttributeName: "pk", KeyType: "HASH" },
            { AttributeName: "sk", KeyType: "RANGE" }
          ],
          AttributeDefinitions: [
            { AttributeName: "pk", AttributeType: "S" },
            { AttributeName: "sk", AttributeType: "S" }
          ],
          BillingMode: "PAY_PER_REQUEST"
        });
        await this.waitForTableActive(MIGRATIONS_TABLE);
        this.initialized = true;
      } else {
        throw error;
      }
    }
  }
  async waitForTableActive(tableName, maxAttempts = 30) {
    for (let i = 0;i < maxAttempts; i++) {
      try {
        const result = await this.client.describeTable(tableName);
        if (result.Table?.TableStatus === "ACTIVE") {
          return;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Table ${tableName} did not become active within ${maxAttempts} seconds`);
  }
  async getLatestState(tableName) {
    await this.ensureMigrationsTable();
    const pk = `${PK_PREFIX}#${tableName}`;
    const result = await this.client.query({
      TableName: MIGRATIONS_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: pk }
      },
      ScanIndexForward: false,
      Limit: 1
    });
    if (!result.Items || result.Items.length === 0) {
      return null;
    }
    return this.unmarshallState(result.Items[0]);
  }
  async getHistory(tableName) {
    await this.ensureMigrationsTable();
    const pk = `${PK_PREFIX}#${tableName}`;
    const result = await this.client.query({
      TableName: MIGRATIONS_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: pk }
      },
      ScanIndexForward: false
    });
    if (!result.Items) {
      return [];
    }
    return result.Items.map((item) => this.unmarshallState(item));
  }
  async recordMigration(tableName, definition, version) {
    await this.ensureMigrationsTable();
    const latest = await this.getLatestState(tableName);
    const newVersion = version ?? (latest ? latest.version + 1 : 1);
    const pk = `${PK_PREFIX}#${tableName}`;
    const sk = `${SK_PREFIX}#${String(newVersion).padStart(6, "0")}`;
    const state = {
      tableName,
      hash: hashTableDefinition(definition),
      definition,
      appliedAt: new Date().toISOString(),
      version: newVersion
    };
    await this.client.putItem({
      TableName: MIGRATIONS_TABLE,
      Item: this.marshallState(state, pk, sk)
    });
    console.log(`[Migration] Recorded migration for ${tableName} (version ${newVersion})`);
    return state;
  }
  async listTrackedTables() {
    await this.ensureMigrationsTable();
    const result = await this.client.scan({
      TableName: MIGRATIONS_TABLE,
      ProjectionExpression: "pk"
    });
    if (!result.Items) {
      return [];
    }
    const tableNames = new Set;
    for (const item of result.Items) {
      const pk = item.pk?.S || "";
      const tableName = pk.replace(`${PK_PREFIX}#`, "");
      if (tableName) {
        tableNames.add(tableName);
      }
    }
    return Array.from(tableNames);
  }
  async hasMigrations(tableName) {
    const state = await this.getLatestState(tableName);
    return state !== null;
  }
  async deleteMigrationHistory(tableName) {
    await this.ensureMigrationsTable();
    const history = await this.getHistory(tableName);
    const pk = `${PK_PREFIX}#${tableName}`;
    for (const state of history) {
      const sk = `${SK_PREFIX}#${String(state.version).padStart(6, "0")}`;
      await this.client.deleteItem({
        TableName: MIGRATIONS_TABLE,
        Key: {
          pk: { S: pk },
          sk: { S: sk }
        }
      });
    }
    console.log(`[Migration] Deleted migration history for ${tableName}`);
  }
  marshallState(state, pk, sk) {
    return {
      pk: { S: pk },
      sk: { S: sk },
      tableName: { S: state.tableName },
      hash: { S: state.hash },
      definition: { S: JSON.stringify(state.definition) },
      appliedAt: { S: state.appliedAt },
      version: { N: String(state.version) }
    };
  }
  unmarshallState(item) {
    return {
      tableName: item.tableName?.S || "",
      hash: item.hash?.S || "",
      definition: JSON.parse(item.definition?.S || "{}"),
      appliedAt: item.appliedAt?.S || "",
      version: Number(item.version?.N || 0)
    };
  }
}
var MIGRATIONS_TABLE = "_qb_migrations", PK_PREFIX = "MIGRATION", SK_PREFIX = "VERSION";
var init_migration_tracker = () => {};

// src/dynamodb/migration-driver.ts
class DynamoDBMigrationDriver {
  client;
  tracker;
  config;
  constructor(config) {
    this.config = config;
    this.client = createClient({
      region: config.region,
      endpoint: config.endpoint,
      credentials: config.credentials
    });
    this.tracker = new DynamoDBMigrationTracker(this.client);
  }
  async execute(plan) {
    const result = {
      tableName: plan.tableName,
      success: true,
      operations: []
    };
    if (plan.operations.length === 0) {
      this.log(`[Migration] No changes needed for ${plan.tableName}`);
      return result;
    }
    this.log(`[Migration] Executing ${plan.operations.length} operations for ${plan.tableName}`);
    try {
      for (const op of plan.operations) {
        await this.executeOperation(op);
        result.operations.push(op.type);
      }
      this.log(`[Migration] Successfully applied ${result.operations.length} operations to ${plan.tableName}`);
    } catch (error) {
      result.success = false;
      result.error = error.message;
      console.error(`[Migration] Failed to execute migration for ${plan.tableName}:`, error);
    }
    return result;
  }
  async executeOperation(op) {
    this.log(`[Migration] Executing ${op.type} on ${op.tableName}`);
    if (this.config.dryRun) {
      this.log(`[Migration] DRY RUN: Would execute ${op.type}`, op.details);
      return;
    }
    switch (op.type) {
      case "CREATE_TABLE":
        await this.createTable(op.details.definition);
        break;
      case "DELETE_TABLE":
        await this.deleteTable(op.tableName);
        break;
      case "ADD_GSI":
        await this.addGSI(op.tableName, op.details.gsi);
        break;
      case "DELETE_GSI":
        await this.deleteGSI(op.tableName, op.details.indexName);
        break;
      case "UPDATE_TTL":
        await this.updateTTL(op.tableName, op.details.ttlAttribute, op.details.enabled);
        break;
      case "UPDATE_BILLING_MODE":
        await this.updateBillingMode(op.tableName, op.details.billingMode, op.details.provisionedThroughput);
        break;
      case "ENABLE_STREAM":
        await this.enableStream(op.tableName, op.details.viewType);
        break;
      case "DISABLE_STREAM":
        await this.disableStream(op.tableName);
        break;
      default:
        throw new Error(`Unknown migration operation type: ${op.type}`);
    }
  }
  async createTable(definition) {
    const input = {
      TableName: definition.tableName,
      KeySchema: [
        { AttributeName: definition.keySchema.partitionKey, KeyType: "HASH" }
      ],
      AttributeDefinitions: definition.attributeDefinitions.map((a) => ({
        AttributeName: a.name,
        AttributeType: a.type
      })),
      BillingMode: definition.billingMode || "PAY_PER_REQUEST"
    };
    if (definition.keySchema.sortKey) {
      input.KeySchema.push({
        AttributeName: definition.keySchema.sortKey,
        KeyType: "RANGE"
      });
    }
    if (definition.billingMode === "PROVISIONED" && definition.provisionedThroughput) {
      input.ProvisionedThroughput = {
        ReadCapacityUnits: definition.provisionedThroughput.readCapacityUnits,
        WriteCapacityUnits: definition.provisionedThroughput.writeCapacityUnits
      };
    }
    if (definition.globalSecondaryIndexes && definition.globalSecondaryIndexes.length > 0) {
      input.GlobalSecondaryIndexes = definition.globalSecondaryIndexes.map((gsi) => ({
        IndexName: gsi.indexName,
        KeySchema: [
          { AttributeName: gsi.keySchema.partitionKey, KeyType: "HASH" },
          ...gsi.keySchema.sortKey ? [{ AttributeName: gsi.keySchema.sortKey, KeyType: "RANGE" }] : []
        ],
        Projection: {
          ProjectionType: gsi.projection.type,
          ...gsi.projection.nonKeyAttributes ? { NonKeyAttributes: gsi.projection.nonKeyAttributes } : {}
        },
        ...gsi.provisionedThroughput ? {
          ProvisionedThroughput: {
            ReadCapacityUnits: gsi.provisionedThroughput.readCapacityUnits,
            WriteCapacityUnits: gsi.provisionedThroughput.writeCapacityUnits
          }
        } : {}
      }));
    }
    if (definition.localSecondaryIndexes && definition.localSecondaryIndexes.length > 0) {
      input.LocalSecondaryIndexes = definition.localSecondaryIndexes.map((lsi) => ({
        IndexName: lsi.indexName,
        KeySchema: [
          { AttributeName: definition.keySchema.partitionKey, KeyType: "HASH" },
          { AttributeName: lsi.sortKey, KeyType: "RANGE" }
        ],
        Projection: {
          ProjectionType: lsi.projection.type,
          ...lsi.projection.nonKeyAttributes ? { NonKeyAttributes: lsi.projection.nonKeyAttributes } : {}
        }
      }));
    }
    if (definition.streamSpecification?.enabled) {
      input.StreamSpecification = {
        StreamEnabled: true,
        StreamViewType: definition.streamSpecification.viewType || "NEW_AND_OLD_IMAGES"
      };
    }
    this.log(`[Migration] Creating table: ${definition.tableName}`);
    await this.client.createTable(input);
    await this.waitForTableActive(definition.tableName);
    if (definition.ttlAttribute) {
      await this.updateTTL(definition.tableName, definition.ttlAttribute, true);
    }
    this.log(`[Migration] Table created: ${definition.tableName}`);
  }
  async deleteTable(tableName) {
    this.log(`[Migration] Deleting table: ${tableName}`);
    await this.client.deleteTable(tableName);
    this.log(`[Migration] Table deleted: ${tableName}`);
  }
  async addGSI(tableName, gsi) {
    this.log(`[Migration] Adding GSI ${gsi.indexName} to ${tableName}`);
    const tableInfo = await this.client.describeTable(tableName);
    const existingAttrs = new Set(tableInfo.Table?.AttributeDefinitions?.map((a) => a.AttributeName) || []);
    const newAttrs = [];
    if (!existingAttrs.has(gsi.keySchema.partitionKey)) {
      newAttrs.push({ AttributeName: gsi.keySchema.partitionKey, AttributeType: "S" });
    }
    if (gsi.keySchema.sortKey && !existingAttrs.has(gsi.keySchema.sortKey)) {
      newAttrs.push({ AttributeName: gsi.keySchema.sortKey, AttributeType: "S" });
    }
    const input = {
      TableName: tableName,
      AttributeDefinitions: newAttrs.length > 0 ? newAttrs : undefined,
      GlobalSecondaryIndexUpdates: [{
        Create: {
          IndexName: gsi.indexName,
          KeySchema: [
            { AttributeName: gsi.keySchema.partitionKey, KeyType: "HASH" },
            ...gsi.keySchema.sortKey ? [{ AttributeName: gsi.keySchema.sortKey, KeyType: "RANGE" }] : []
          ],
          Projection: {
            ProjectionType: gsi.projection.type,
            ...gsi.projection.nonKeyAttributes ? { NonKeyAttributes: gsi.projection.nonKeyAttributes } : {}
          },
          ...gsi.provisionedThroughput ? {
            ProvisionedThroughput: {
              ReadCapacityUnits: gsi.provisionedThroughput.readCapacityUnits,
              WriteCapacityUnits: gsi.provisionedThroughput.writeCapacityUnits
            }
          } : {}
        }
      }]
    };
    await this.executeUpdateTable(input);
    await this.waitForGSIActive(tableName, gsi.indexName);
    this.log(`[Migration] GSI ${gsi.indexName} added to ${tableName}`);
  }
  async deleteGSI(tableName, indexName) {
    this.log(`[Migration] Deleting GSI ${indexName} from ${tableName}`);
    const input = {
      TableName: tableName,
      GlobalSecondaryIndexUpdates: [{
        Delete: {
          IndexName: indexName
        }
      }]
    };
    await this.executeUpdateTable(input);
    this.log(`[Migration] GSI ${indexName} deleted from ${tableName}`);
  }
  async updateTTL(tableName, ttlAttribute, enabled) {
    this.log(`[Migration] Updating TTL on ${tableName}: ${enabled ? ttlAttribute : "disabled"}`);
    const input = {
      TableName: tableName,
      TimeToLiveSpecification: {
        Enabled: enabled,
        AttributeName: ttlAttribute || "ttl"
      }
    };
    await this.executeUpdateTimeToLive(input);
    this.log(`[Migration] TTL updated on ${tableName}`);
  }
  async updateBillingMode(tableName, billingMode, provisionedThroughput) {
    this.log(`[Migration] Updating billing mode on ${tableName} to ${billingMode}`);
    const input = {
      TableName: tableName,
      BillingMode: billingMode
    };
    if (billingMode === "PROVISIONED" && provisionedThroughput) {
      input.ProvisionedThroughput = {
        ReadCapacityUnits: provisionedThroughput.readCapacityUnits,
        WriteCapacityUnits: provisionedThroughput.writeCapacityUnits
      };
    }
    await this.executeUpdateTable(input);
    await this.waitForTableActive(tableName);
    this.log(`[Migration] Billing mode updated on ${tableName}`);
  }
  async enableStream(tableName, viewType) {
    this.log(`[Migration] Enabling stream on ${tableName} with view type ${viewType}`);
    const input = {
      TableName: tableName,
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: viewType
      }
    };
    await this.executeUpdateTable(input);
    await this.waitForTableActive(tableName);
    this.log(`[Migration] Stream enabled on ${tableName}`);
  }
  async disableStream(tableName) {
    this.log(`[Migration] Disabling stream on ${tableName}`);
    const input = {
      TableName: tableName,
      StreamSpecification: {
        StreamEnabled: false
      }
    };
    await this.executeUpdateTable(input);
    await this.waitForTableActive(tableName);
    this.log(`[Migration] Stream disabled on ${tableName}`);
  }
  async executeUpdateTable(input) {
    await this.client.updateTable(input);
  }
  async executeUpdateTimeToLive(input) {
    await this.client.updateTimeToLive(input);
  }
  async waitForTableActive(tableName, maxAttempts = 60) {
    this.log(`[Migration] Waiting for table ${tableName} to become active...`);
    for (let i = 0;i < maxAttempts; i++) {
      try {
        const result = await this.client.describeTable(tableName);
        const status = result.Table?.TableStatus;
        if (status === "ACTIVE") {
          return;
        }
        this.log(`[Migration] Table status: ${status}, waiting...`);
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`Table ${tableName} did not become active within ${maxAttempts * 2} seconds`);
  }
  async waitForGSIActive(tableName, indexName, maxAttempts = 120) {
    this.log(`[Migration] Waiting for GSI ${indexName} to become active...`);
    for (let i = 0;i < maxAttempts; i++) {
      try {
        const result = await this.client.describeTable(tableName);
        const gsi = result.Table?.GlobalSecondaryIndexes?.find((g) => g.IndexName === indexName);
        if (gsi?.IndexStatus === "ACTIVE") {
          return;
        }
        const status = gsi?.IndexStatus || "CREATING";
        this.log(`[Migration] GSI status: ${status}, waiting...`);
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    throw new Error(`GSI ${indexName} did not become active within ${maxAttempts * 5} seconds`);
  }
  async migrateModel(ModelClass) {
    const definition = extractTableDefinition(ModelClass);
    let currentDefinition = null;
    try {
      const tableInfo = await this.client.describeTable(definition.tableName);
      if (tableInfo.Table) {
        currentDefinition = this.tableInfoToDefinition(tableInfo.Table);
      }
    } catch (error) {
      if (!error.message?.includes("ResourceNotFoundException") && !error.message?.includes("not found")) {
        throw error;
      }
    }
    const plan = buildMigrationPlan(currentDefinition, definition);
    const result = await this.execute(plan);
    if (result.success && !this.config.dryRun) {
      result.state = await this.tracker.recordMigration(definition.tableName, definition);
    }
    return result;
  }
  async migrateModels(models) {
    const results = [];
    for (const ModelClass of models) {
      try {
        const result = await this.migrateModel(ModelClass);
        results.push(result);
      } catch (error) {
        results.push({
          tableName: ModelClass.tableName || "unknown",
          success: false,
          operations: [],
          error: error.message
        });
      }
    }
    return results;
  }
  async getStatus() {
    const status = new Map;
    const tables = await this.tracker.listTrackedTables();
    for (const tableName of tables) {
      const state = await this.tracker.getLatestState(tableName);
      status.set(tableName, state);
    }
    return status;
  }
  tableInfoToDefinition(tableInfo) {
    const keySchema = {
      partitionKey: "",
      sortKey: undefined
    };
    for (const key of tableInfo.KeySchema || []) {
      if (key.KeyType === "HASH") {
        keySchema.partitionKey = key.AttributeName;
      } else if (key.KeyType === "RANGE") {
        keySchema.sortKey = key.AttributeName;
      }
    }
    const attributeDefinitions = (tableInfo.AttributeDefinitions || []).map((a) => ({
      name: a.AttributeName,
      type: a.AttributeType
    }));
    const gsis = (tableInfo.GlobalSecondaryIndexes || []).map((gsi) => {
      const gsiKeySchema = {
        partitionKey: "",
        sortKey: undefined
      };
      for (const key of gsi.KeySchema || []) {
        if (key.KeyType === "HASH") {
          gsiKeySchema.partitionKey = key.AttributeName;
        } else if (key.KeyType === "RANGE") {
          gsiKeySchema.sortKey = key.AttributeName;
        }
      }
      return {
        indexName: gsi.IndexName,
        keySchema: gsiKeySchema,
        projection: {
          type: gsi.Projection?.ProjectionType || "ALL",
          nonKeyAttributes: gsi.Projection?.NonKeyAttributes
        },
        provisionedThroughput: gsi.ProvisionedThroughput ? {
          readCapacityUnits: gsi.ProvisionedThroughput.ReadCapacityUnits,
          writeCapacityUnits: gsi.ProvisionedThroughput.WriteCapacityUnits
        } : undefined
      };
    });
    return {
      tableName: tableInfo.TableName,
      keySchema,
      attributeDefinitions,
      globalSecondaryIndexes: gsis.length > 0 ? gsis : undefined,
      billingMode: tableInfo.BillingModeSummary?.BillingMode || "PAY_PER_REQUEST",
      provisionedThroughput: tableInfo.ProvisionedThroughput ? {
        readCapacityUnits: tableInfo.ProvisionedThroughput.ReadCapacityUnits,
        writeCapacityUnits: tableInfo.ProvisionedThroughput.WriteCapacityUnits
      } : undefined,
      ttlAttribute: tableInfo.TimeToLiveDescription?.AttributeName,
      streamSpecification: tableInfo.StreamSpecification ? {
        enabled: tableInfo.StreamSpecification.StreamEnabled,
        viewType: tableInfo.StreamSpecification.StreamViewType
      } : undefined
    };
  }
  log(...args) {
    if (this.config.verbose || this.config.dryRun) {
      console.log(...args);
    }
  }
}
function createMigrationDriver(config) {
  return new DynamoDBMigrationDriver(config);
}
async function migrateModels(models, config) {
  const driver = createMigrationDriver(config);
  return driver.migrateModels(models);
}
var init_migration_driver = __esm(() => {
  init_migration_tracker();
});

// src/dynamodb/index.ts
class EntityQueryBuilder {
  driver;
  client;
  tableName;
  pkAttribute;
  skAttribute;
  entityTypeAttr;
  delimiter;
  _entityType;
  _pkValue;
  _skCondition;
  _indexName;
  _projectionAttrs = [];
  _filterConditions = [];
  _limitValue;
  _scanForward = true;
  _consistentRead = false;
  _startKey;
  constructor(driver, client, tableName, config) {
    this.driver = driver;
    this.client = client;
    this.tableName = tableName;
    this.pkAttribute = config.pkAttribute;
    this.skAttribute = config.skAttribute;
    this.entityTypeAttr = config.entityTypeAttribute;
    this.delimiter = config.keyDelimiter;
  }
  entity(entityType) {
    this._entityType = entityType;
    return this;
  }
  pk(value) {
    this._pkValue = value;
    return this;
  }
  get sk() {
    const self = this;
    return {
      equals(value) {
        self._skCondition = { type: "eq", value };
        return self;
      },
      beginsWith(prefix) {
        self._skCondition = { type: "begins_with", value: prefix };
        return self;
      },
      between(start, end) {
        self._skCondition = { type: "between", value: start, value2: end };
        return self;
      },
      lt(value) {
        self._skCondition = { type: "lt", value };
        return self;
      },
      lte(value) {
        self._skCondition = { type: "lte", value };
        return self;
      },
      gt(value) {
        self._skCondition = { type: "gt", value };
        return self;
      },
      gte(value) {
        self._skCondition = { type: "gte", value };
        return self;
      }
    };
  }
  index(indexName) {
    this._indexName = indexName;
    return this;
  }
  project(...attributes) {
    this._projectionAttrs.push(...attributes);
    return this;
  }
  filter(attribute, operator, value) {
    this._filterConditions.push({ attribute, operator, value });
    return this;
  }
  where(attribute, value) {
    return this.filter(attribute, "=", value);
  }
  whereIn(attribute, values) {
    this._filterConditions.push({ attribute, operator: "IN", values });
    return this;
  }
  limit(count) {
    this._limitValue = count;
    return this;
  }
  asc() {
    this._scanForward = true;
    return this;
  }
  desc() {
    this._scanForward = false;
    return this;
  }
  consistent() {
    this._consistentRead = true;
    return this;
  }
  startFrom(key) {
    this._startKey = key;
    return this;
  }
  toRequest() {
    const request = {
      TableName: this.tableName
    };
    if (this._indexName) {
      request.IndexName = this._indexName;
    }
    const keyConditions = [];
    const exprNames = {};
    const exprValues = {};
    let idx = 0;
    if (this._pkValue) {
      const nameKey = `#pk${idx}`;
      const valueKey = `:pk${idx}`;
      exprNames[nameKey] = this.pkAttribute;
      exprValues[valueKey] = { S: this._pkValue };
      keyConditions.push(`${nameKey} = ${valueKey}`);
      idx++;
    }
    if (this._skCondition) {
      const nameKey = `#sk${idx}`;
      exprNames[nameKey] = this.skAttribute;
      switch (this._skCondition.type) {
        case "eq": {
          const valueKey = `:sk${idx}`;
          exprValues[valueKey] = { S: this._skCondition.value };
          keyConditions.push(`${nameKey} = ${valueKey}`);
          break;
        }
        case "begins_with": {
          const valueKey = `:sk${idx}`;
          exprValues[valueKey] = { S: this._skCondition.value };
          keyConditions.push(`begins_with(${nameKey}, ${valueKey})`);
          break;
        }
        case "between": {
          const valueKey1 = `:sk${idx}a`;
          const valueKey2 = `:sk${idx}b`;
          exprValues[valueKey1] = { S: this._skCondition.value };
          exprValues[valueKey2] = { S: this._skCondition.value2 };
          keyConditions.push(`${nameKey} BETWEEN ${valueKey1} AND ${valueKey2}`);
          break;
        }
        case "lt": {
          const valueKey = `:sk${idx}`;
          exprValues[valueKey] = { S: this._skCondition.value };
          keyConditions.push(`${nameKey} < ${valueKey}`);
          break;
        }
        case "lte": {
          const valueKey = `:sk${idx}`;
          exprValues[valueKey] = { S: this._skCondition.value };
          keyConditions.push(`${nameKey} <= ${valueKey}`);
          break;
        }
        case "gt": {
          const valueKey = `:sk${idx}`;
          exprValues[valueKey] = { S: this._skCondition.value };
          keyConditions.push(`${nameKey} > ${valueKey}`);
          break;
        }
        case "gte": {
          const valueKey = `:sk${idx}`;
          exprValues[valueKey] = { S: this._skCondition.value };
          keyConditions.push(`${nameKey} >= ${valueKey}`);
          break;
        }
      }
      idx++;
    }
    if (keyConditions.length > 0) {
      request.KeyConditionExpression = keyConditions.join(" AND ");
    }
    if (this._filterConditions.length > 0) {
      const filterParts = [];
      for (const cond of this._filterConditions) {
        const nameKey = `#flt${idx}`;
        exprNames[nameKey] = cond.attribute;
        if (cond.operator === "IN" && cond.values) {
          const valueKeys = cond.values.map((_, i) => `:flt${idx}_${i}`);
          cond.values.forEach((val, i) => {
            exprValues[`:flt${idx}_${i}`] = this.driver.marshall({ v: val }).v;
          });
          filterParts.push(`${nameKey} IN (${valueKeys.join(", ")})`);
        } else {
          const valueKey = `:flt${idx}`;
          exprValues[valueKey] = this.driver.marshall({ v: cond.value }).v;
          filterParts.push(`${nameKey} ${cond.operator} ${valueKey}`);
        }
        idx++;
      }
      request.FilterExpression = filterParts.join(" AND ");
    }
    if (this._projectionAttrs.length > 0) {
      const projParts = [];
      for (const attr of this._projectionAttrs) {
        const nameKey = `#proj${idx}`;
        exprNames[nameKey] = attr;
        projParts.push(nameKey);
        idx++;
      }
      request.ProjectionExpression = projParts.join(", ");
    }
    if (Object.keys(exprNames).length > 0) {
      request.ExpressionAttributeNames = exprNames;
    }
    if (Object.keys(exprValues).length > 0) {
      request.ExpressionAttributeValues = exprValues;
    }
    if (this._limitValue !== undefined) {
      request.Limit = this._limitValue;
    }
    request.ScanIndexForward = this._scanForward;
    if (this._consistentRead) {
      request.ConsistentRead = true;
    }
    if (this._startKey) {
      request.ExclusiveStartKey = this.driver.marshall(this._startKey);
    }
    return request;
  }
  async get() {
    if (!this.client) {
      throw new Error("DynamoDB client not configured. Call dynamo.connection() first.");
    }
    const request = this.toRequest();
    const isQuery = this._pkValue !== undefined;
    const response = isQuery ? await this.client.query(request) : await this.client.scan(request);
    return (response.Items ?? []).map((item) => this.driver.unmarshall(item));
  }
  async first() {
    this._limitValue = 1;
    const results = await this.get();
    return results[0];
  }
  async getAll() {
    const allItems = [];
    let lastKey;
    do {
      if (lastKey) {
        this._startKey = lastKey;
      }
      const request = this.toRequest();
      const isQuery = this._pkValue !== undefined;
      const response = isQuery ? await this.client.query(request) : await this.client.scan(request);
      const items = (response.Items ?? []).map((item) => this.driver.unmarshall(item));
      allItems.push(...items);
      lastKey = response.LastEvaluatedKey ? this.driver.unmarshall(response.LastEvaluatedKey) : undefined;
    } while (lastKey);
    return allItems;
  }
  async count() {
    if (!this.client) {
      throw new Error("DynamoDB client not configured. Call dynamo.connection() first.");
    }
    const request = this.toRequest();
    request.Select = "COUNT";
    const isQuery = this._pkValue !== undefined;
    const response = isQuery ? await this.client.query(request) : await this.client.scan(request);
    return response.Count ?? 0;
  }
}

class DynamoClient {
  driver;
  client;
  tableName = "";
  pkAttribute = "pk";
  skAttribute = "sk";
  entityTypeAttr = "_et";
  delimiter = "#";
  entityMappings = new Map;
  connection(config) {
    const driverConfig = {
      region: config.region,
      tableName: config.table,
      endpoint: config.endpoint,
      credentials: config.credentials
    };
    this.driver = createDynamoDBDriver(driverConfig);
    this.tableName = config.table;
    this.pkAttribute = config.pkAttribute ?? "pk";
    this.skAttribute = config.skAttribute ?? "sk";
    this.entityTypeAttr = config.entityTypeAttribute ?? "_et";
    this.delimiter = config.keyDelimiter ?? "#";
    return this;
  }
  setClient(client) {
    this.client = client;
    return this;
  }
  registerEntity(mapping) {
    this.entityMappings.set(mapping.entityType, mapping);
    if (this.driver) {
      this.driver.registerEntity(mapping);
    }
    return this;
  }
  entity(entityType) {
    if (!this.driver) {
      throw new Error("DynamoDB not configured. Call dynamo.connection() first.");
    }
    const builder = new EntityQueryBuilder(this.driver, this.client, this.tableName, {
      pkAttribute: this.pkAttribute,
      skAttribute: this.skAttribute,
      entityTypeAttribute: this.entityTypeAttr,
      keyDelimiter: this.delimiter
    });
    return builder.entity(entityType);
  }
  async batchWrite(operations) {
    if (!this.client) {
      throw new Error("DynamoDB client not configured. Call setClient() first.");
    }
    if (!this.driver) {
      throw new Error("DynamoDB not configured. Call dynamo.connection() first.");
    }
    const requestItems = [];
    for (const op of operations) {
      if (op.put) {
        const item = {
          ...op.put.item,
          [this.entityTypeAttr]: op.put.entity
        };
        requestItems.push({
          PutRequest: {
            Item: this.driver.marshall(item)
          }
        });
      } else if (op.delete) {
        requestItems.push({
          DeleteRequest: {
            Key: this.driver.marshall({
              [this.pkAttribute]: op.delete.pk,
              [this.skAttribute]: op.delete.sk
            })
          }
        });
      }
    }
    if (requestItems.length > 0) {
      await this.client.batchWriteItem({
        RequestItems: {
          [this.tableName]: requestItems
        }
      });
    }
  }
  async transactWrite(operations) {
    if (!this.client) {
      throw new Error("DynamoDB client not configured. Call setClient() first.");
    }
    if (!this.driver) {
      throw new Error("DynamoDB not configured. Call dynamo.connection() first.");
    }
    const transactItems = [];
    for (const op of operations) {
      if (op.put) {
        const item = {
          ...op.put.item,
          [this.entityTypeAttr]: op.put.entity
        };
        const transactItem = {
          Put: {
            TableName: this.tableName,
            Item: this.driver.marshall(item)
          }
        };
        if (op.put.condition) {
          transactItem.Put.ConditionExpression = op.put.condition;
        }
        transactItems.push(transactItem);
      } else if (op.update) {
        const key = {
          [this.pkAttribute]: op.update.pk
        };
        if (op.update.sk) {
          key[this.skAttribute] = op.update.sk;
        }
        const updateParts = [];
        const exprNames = {};
        const exprValues = {};
        let idx = 0;
        if (op.update.set) {
          const setParts = [];
          for (const [attr, value] of Object.entries(op.update.set)) {
            const nameKey = `#set${idx}`;
            const valueKey = `:set${idx}`;
            exprNames[nameKey] = attr;
            exprValues[valueKey] = this.driver.marshall({ v: value }).v;
            setParts.push(`${nameKey} = ${valueKey}`);
            idx++;
          }
          if (setParts.length > 0) {
            updateParts.push(`SET ${setParts.join(", ")}`);
          }
        }
        if (op.update.add) {
          const addParts = [];
          for (const [attr, value] of Object.entries(op.update.add)) {
            const nameKey = `#add${idx}`;
            const valueKey = `:add${idx}`;
            exprNames[nameKey] = attr;
            exprValues[valueKey] = { N: String(value) };
            addParts.push(`${nameKey} ${valueKey}`);
            idx++;
          }
          if (addParts.length > 0) {
            updateParts.push(`ADD ${addParts.join(", ")}`);
          }
        }
        if (op.update.remove && op.update.remove.length > 0) {
          const removeParts = [];
          for (const attr of op.update.remove) {
            const nameKey = `#rem${idx}`;
            exprNames[nameKey] = attr;
            removeParts.push(nameKey);
            idx++;
          }
          updateParts.push(`REMOVE ${removeParts.join(", ")}`);
        }
        transactItems.push({
          Update: {
            TableName: this.tableName,
            Key: this.driver.marshall(key),
            UpdateExpression: updateParts.join(" "),
            ExpressionAttributeNames: exprNames,
            ExpressionAttributeValues: exprValues
          }
        });
      } else if (op.delete) {
        const transactItem = {
          Delete: {
            TableName: this.tableName,
            Key: this.driver.marshall({
              [this.pkAttribute]: op.delete.pk,
              [this.skAttribute]: op.delete.sk
            })
          }
        };
        if (op.delete.condition) {
          transactItem.Delete.ConditionExpression = op.delete.condition;
        }
        transactItems.push(transactItem);
      } else if (op.conditionCheck) {
        transactItems.push({
          ConditionCheck: {
            TableName: this.tableName,
            Key: this.driver.marshall({
              [this.pkAttribute]: op.conditionCheck.pk,
              [this.skAttribute]: op.conditionCheck.sk
            }),
            ConditionExpression: op.conditionCheck.condition
          }
        });
      }
    }
    if (transactItems.length > 0) {
      await this.client.transactWriteItems({
        TransactItems: transactItems
      });
    }
  }
  getDriver() {
    return this.driver;
  }
}
function createDynamo() {
  return new DynamoClient;
}
var dynamo;
var init_dynamodb = __esm(() => {
  init_model();
  init_migration_driver();
  init_migration_tracker();
  dynamo = new DynamoClient;
});
init_dynamodb();

export {
  migrateModels,
  isDefinitionEqual,
  hashTableDefinition,
  extractTableDefinition,
  extractModelSchema,
  dynamo,
  createMigrationDriver,
  createDynamo,
  createClient,
  convertSchemaToDefinition,
  configureModels,
  buildMigrationPlan as buildDynamoDBMigrationPlan,
  Model,
  MIGRATIONS_TABLE,
  EntityQueryBuilder,
  DynamoDBMigrationTracker,
  DynamoDBMigrationDriver,
  DynamoDBClient
};
