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

// src/browser.ts
function configureBrowser(config) {
  browserConfig = { ...browserConfig, ...config };
}
function getBrowserConfig() {
  return browserConfig;
}
function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}
async function getAuthToken() {
  if (browserConfig.getToken) {
    const token = browserConfig.getToken();
    return token instanceof Promise ? token : token;
  }
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("auth_token");
  }
  return null;
}
async function buildHeaders() {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...browserConfig.headers
  };
  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
async function handleResponse(response) {
  if (response.status === 401) {
    browserConfig.onUnauthorized?.();
    throw new BrowserQueryError("Unauthorized", 401);
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new BrowserQueryError(error.message || `HTTP ${response.status}`, response.status);
  }
  const data = await response.json();
  if (browserConfig.transformResponse) {
    return browserConfig.transformResponse(data);
  }
  return data;
}

class BrowserQueryBuilder {
  state;
  constructor(table) {
    this.state = {
      table,
      wheres: [],
      orderBy: [],
      selectColumns: ["*"],
      withRelations: []
    };
  }
  select(...columns) {
    this.state.selectColumns = columns;
    return this;
  }
  where(column, operatorOrValue, value) {
    if (value === undefined) {
      this.state.wheres.push({
        column,
        operator: "=",
        value: operatorOrValue,
        boolean: "and"
      });
    } else {
      this.state.wheres.push({
        column,
        operator: operatorOrValue,
        value,
        boolean: "and"
      });
    }
    return this;
  }
  orWhere(column, operatorOrValue, value) {
    if (value === undefined) {
      this.state.wheres.push({
        column,
        operator: "=",
        value: operatorOrValue,
        boolean: "or"
      });
    } else {
      this.state.wheres.push({
        column,
        operator: operatorOrValue,
        value,
        boolean: "or"
      });
    }
    return this;
  }
  andWhere(column, operatorOrValue, value) {
    return this.where(column, operatorOrValue, value);
  }
  whereNull(column) {
    return this.where(column, "is", null);
  }
  whereNotNull(column) {
    return this.where(column, "is not", null);
  }
  whereIn(column, values) {
    return this.where(column, "in", values);
  }
  whereNotIn(column, values) {
    return this.where(column, "not in", values);
  }
  orderBy(column, direction = "asc") {
    this.state.orderBy.push({ column, direction });
    return this;
  }
  orderByDesc(column) {
    return this.orderBy(column, "desc");
  }
  latest(column = "created_at") {
    return this.orderBy(column, "desc");
  }
  oldest(column = "created_at") {
    return this.orderBy(column, "asc");
  }
  limit(count) {
    this.state.limitValue = count;
    return this;
  }
  offset(count) {
    this.state.offsetValue = count;
    return this;
  }
  skip(count) {
    return this.offset(count);
  }
  take(count) {
    return this.limit(count);
  }
  with(...relations) {
    this.state.withRelations.push(...relations);
    return this;
  }
  buildQueryParams() {
    const params = new URLSearchParams;
    for (const where of this.state.wheres) {
      if (where.operator === "=") {
        params.append(where.column, String(where.value));
      } else if (where.operator === "in" && Array.isArray(where.value)) {
        params.append(`${where.column}[]`, where.value.join(","));
      } else if (where.operator === "is" && where.value === null) {
        params.append(`filter[${where.column}][is]`, "null");
      } else if (where.operator === "is not" && where.value === null) {
        params.append(`filter[${where.column}][is_not]`, "null");
      } else {
        params.append(`filter[${where.column}][${where.operator}]`, String(where.value));
      }
    }
    if (this.state.orderBy.length > 0) {
      const orderStr = this.state.orderBy.map((o) => `${o.direction === "desc" ? "-" : ""}${o.column}`).join(",");
      params.append("sort", orderStr);
    }
    if (this.state.limitValue !== undefined) {
      params.append("limit", String(this.state.limitValue));
    }
    if (this.state.offsetValue !== undefined) {
      params.append("offset", String(this.state.offsetValue));
    }
    if (this.state.selectColumns.length > 0 && !this.state.selectColumns.includes("*")) {
      params.append("fields", this.state.selectColumns.join(","));
    }
    if (this.state.withRelations.length > 0) {
      params.append("include", this.state.withRelations.join(","));
    }
    return params;
  }
  buildUrl(path) {
    const base = `${browserConfig.baseUrl}/${this.state.table}`;
    if (path !== undefined) {
      return `${base}/${path}`;
    }
    const params = this.buildQueryParams();
    const queryString = params.toString();
    return queryString ? `${base}?${queryString}` : base;
  }
  async get() {
    const url = this.buildUrl();
    const response = await fetch(url, {
      method: "GET",
      headers: await buildHeaders()
    });
    const result = await handleResponse(response);
    return Array.isArray(result) ? result : result.data;
  }
  async first() {
    this.limit(1);
    const results = await this.get();
    return results[0] ?? null;
  }
  async firstOrFail() {
    const result = await this.first();
    if (!result) {
      throw new BrowserQueryError(`No ${this.state.table} found`, 404);
    }
    return result;
  }
  async find(id) {
    const url = this.buildUrl(id);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: await buildHeaders()
      });
      if (response.status === 404) {
        return null;
      }
      const result = await handleResponse(response);
      return "data" in result && !Array.isArray(result.data) ? result.data : result;
    } catch {
      return null;
    }
  }
  async findOrFail(id) {
    const result = await this.find(id);
    if (!result) {
      throw new BrowserQueryError(`${this.state.table} with id ${id} not found`, 404);
    }
    return result;
  }
  async count() {
    const params = this.buildQueryParams();
    params.append("count", "true");
    const url = `${browserConfig.baseUrl}/${this.state.table}?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: await buildHeaders()
    });
    const result = await handleResponse(response);
    return result.count;
  }
  async exists() {
    const count = await this.count();
    return count > 0;
  }
  async create(data) {
    const url = `${browserConfig.baseUrl}/${this.state.table}`;
    const body = browserConfig.transformRequest ? browserConfig.transformRequest(data) : data;
    const response = await fetch(url, {
      method: "POST",
      headers: await buildHeaders(),
      body: JSON.stringify(body)
    });
    const result = await handleResponse(response);
    return "data" in result && !Array.isArray(result.data) ? result.data : result;
  }
  async insert(data) {
    return this.create(data);
  }
  async update(id, data) {
    const url = `${browserConfig.baseUrl}/${this.state.table}/${id}`;
    const body = browserConfig.transformRequest ? browserConfig.transformRequest(data) : data;
    const response = await fetch(url, {
      method: "PATCH",
      headers: await buildHeaders(),
      body: JSON.stringify(body)
    });
    const result = await handleResponse(response);
    return "data" in result && !Array.isArray(result.data) ? result.data : result;
  }
  async delete(id) {
    const url = `${browserConfig.baseUrl}/${this.state.table}/${id}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: await buildHeaders()
    });
    return response.ok;
  }
  async destroy(id) {
    return this.delete(id);
  }
  async paginate(page = 1, perPage = 15) {
    this.limit(perPage).offset((page - 1) * perPage);
    const params = this.buildQueryParams();
    params.append("paginate", "true");
    const url = `${browserConfig.baseUrl}/${this.state.table}?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: await buildHeaders()
    });
    return handleResponse(response);
  }
  toState() {
    return { ...this.state };
  }
}
function browserQuery(table) {
  return new BrowserQueryBuilder(table);
}
function createBrowserDb() {
  return new Proxy({}, {
    get: (_target, prop) => {
      return () => browserQuery(prop);
    }
  });
}

class BrowserModelInstance {
  _attributes;
  _definition;
  constructor(definition, attributes = {}) {
    this._definition = definition;
    this._attributes = { ...attributes };
  }
  get(key) {
    return this._attributes[key];
  }
  set(key, value) {
    this._attributes[key] = value;
  }
  get attributes() {
    return { ...this._attributes };
  }
  get id() {
    const pk = this._definition.primaryKey || "id";
    return this._attributes[pk];
  }
  toJSON() {
    const hidden = new Set;
    for (const [key, attr] of Object.entries(this._definition.attributes)) {
      if (attr.hidden)
        hidden.add(key);
    }
    const json = {};
    for (const [key, value] of Object.entries(this._attributes)) {
      if (!hidden.has(key))
        json[key] = value;
    }
    return json;
  }
}

class BrowserModelQueryBuilder {
  _definition;
  _wheres = [];
  _orderBy = [];
  _limit;
  _offset;
  _select = ["*"];
  _withRelations = [];
  constructor(definition) {
    this._definition = definition;
  }
  getTablePath() {
    return typeof this._definition.traits?.useApi === "object" && this._definition.traits.useApi?.uri || this._definition.table;
  }
  where(column, operatorOrValue, value) {
    if (value === undefined) {
      this._wheres.push({ column, operator: "=", value: operatorOrValue, boolean: "and" });
    } else {
      this._wheres.push({ column, operator: operatorOrValue, value, boolean: "and" });
    }
    return this;
  }
  orWhere(column, operatorOrValue, value) {
    if (value === undefined) {
      this._wheres.push({ column, operator: "=", value: operatorOrValue, boolean: "or" });
    } else {
      this._wheres.push({ column, operator: operatorOrValue, value, boolean: "or" });
    }
    return this;
  }
  whereIn(column, values) {
    this._wheres.push({ column, operator: "in", value: values, boolean: "and" });
    return this;
  }
  whereNotIn(column, values) {
    this._wheres.push({ column, operator: "not in", value: values, boolean: "and" });
    return this;
  }
  whereNull(column) {
    this._wheres.push({ column, operator: "is", value: null, boolean: "and" });
    return this;
  }
  whereNotNull(column) {
    this._wheres.push({ column, operator: "is not", value: null, boolean: "and" });
    return this;
  }
  whereLike(column, pattern) {
    this._wheres.push({ column, operator: "like", value: pattern, boolean: "and" });
    return this;
  }
  orderBy(column, direction = "asc") {
    this._orderBy.push({ column, direction });
    return this;
  }
  orderByDesc(column) {
    return this.orderBy(column, "desc");
  }
  orderByAsc(column) {
    return this.orderBy(column, "asc");
  }
  limit(count) {
    this._limit = count;
    return this;
  }
  take(count) {
    return this.limit(count);
  }
  offset(count) {
    this._offset = count;
    return this;
  }
  skip(count) {
    return this.offset(count);
  }
  select(...columns) {
    this._select = columns;
    return this;
  }
  with(...relations) {
    this._withRelations.push(...relations);
    return this;
  }
  latest(column = "created_at") {
    return this.orderByDesc(column);
  }
  oldest(column = "created_at") {
    return this.orderByAsc(column);
  }
  buildQueryParams() {
    const params = new URLSearchParams;
    for (const where of this._wheres) {
      if (where.operator === "=") {
        params.append(where.column, String(where.value));
      } else if ((where.operator === "in" || where.operator === "not in") && Array.isArray(where.value)) {
        params.append(`${where.column}[]`, where.value.join(","));
      } else if (where.operator === "is" && where.value === null) {
        params.append(`filter[${where.column}][is]`, "null");
      } else if (where.operator === "is not" && where.value === null) {
        params.append(`filter[${where.column}][is_not]`, "null");
      } else {
        params.append(`filter[${where.column}][${where.operator}]`, String(where.value));
      }
    }
    if (this._orderBy.length > 0) {
      const orderStr = this._orderBy.map((o) => `${o.direction === "desc" ? "-" : ""}${o.column}`).join(",");
      params.append("sort", orderStr);
    }
    if (this._limit !== undefined)
      params.append("limit", String(this._limit));
    if (this._offset !== undefined)
      params.append("offset", String(this._offset));
    if (this._select.length > 0 && !this._select.includes("*")) {
      params.append("fields", this._select.join(","));
    }
    if (this._withRelations.length > 0) {
      params.append("include", this._withRelations.join(","));
    }
    return params;
  }
  buildUrl(path) {
    const base = `${browserConfig.baseUrl}/${this.getTablePath()}`;
    if (path !== undefined)
      return `${base}/${path}`;
    const params = this.buildQueryParams();
    const queryString = params.toString();
    return queryString ? `${base}?${queryString}` : base;
  }
  async get() {
    const url = this.buildUrl();
    const response = await fetch(url, {
      method: "GET",
      headers: await buildHeaders()
    });
    const result = await handleResponse(response);
    const rows = Array.isArray(result) ? result : result.data;
    return rows.map((row) => new BrowserModelInstance(this._definition, row));
  }
  async first() {
    this._limit = 1;
    const results = await this.get();
    return results[0] ?? null;
  }
  async firstOrFail() {
    const result = await this.first();
    if (!result)
      throw new BrowserQueryError(`No ${this._definition.name} found`, 404);
    return result;
  }
  async find(id) {
    const url = this.buildUrl(id);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: await buildHeaders()
      });
      if (response.status === 404)
        return null;
      const result = await handleResponse(response);
      const row = "data" in result && !Array.isArray(result.data) ? result.data : result;
      return new BrowserModelInstance(this._definition, row);
    } catch {
      return null;
    }
  }
  async findOrFail(id) {
    const result = await this.find(id);
    if (!result)
      throw new BrowserQueryError(`${this._definition.name} with id ${id} not found`, 404);
    return result;
  }
  async count() {
    const params = this.buildQueryParams();
    params.append("count", "true");
    const url = `${browserConfig.baseUrl}/${this.getTablePath()}?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: await buildHeaders()
    });
    const result = await handleResponse(response);
    return result.count;
  }
  async exists() {
    const count = await this.count();
    return count > 0;
  }
  async pluck(column) {
    this._select = [column];
    const results = await this.get();
    return results.map((r) => r.get(column));
  }
  async paginate(page = 1, perPage = 15) {
    this._limit = perPage;
    this._offset = (page - 1) * perPage;
    const params = this.buildQueryParams();
    params.append("paginate", "true");
    const url = `${browserConfig.baseUrl}/${this.getTablePath()}?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: await buildHeaders()
    });
    const result = await handleResponse(response);
    return {
      ...result,
      data: result.data.map((row) => new BrowserModelInstance(this._definition, row))
    };
  }
}
function createBrowserModel(definition) {
  const model = {
    query: () => new BrowserModelQueryBuilder(definition),
    where(column, operatorOrValue, value) {
      return new BrowserModelQueryBuilder(definition).where(column, operatorOrValue, value);
    },
    orWhere(column, operatorOrValue, value) {
      return new BrowserModelQueryBuilder(definition).orWhere(column, operatorOrValue, value);
    },
    whereIn(column, values) {
      return new BrowserModelQueryBuilder(definition).whereIn(column, values);
    },
    whereNotIn(column, values) {
      return new BrowserModelQueryBuilder(definition).whereNotIn(column, values);
    },
    whereNull(column) {
      return new BrowserModelQueryBuilder(definition).whereNull(column);
    },
    whereNotNull(column) {
      return new BrowserModelQueryBuilder(definition).whereNotNull(column);
    },
    whereLike(column, pattern) {
      return new BrowserModelQueryBuilder(definition).whereLike(column, pattern);
    },
    orderBy(column, direction = "asc") {
      return new BrowserModelQueryBuilder(definition).orderBy(column, direction);
    },
    orderByDesc(column) {
      return new BrowserModelQueryBuilder(definition).orderByDesc(column);
    },
    select(...columns) {
      return new BrowserModelQueryBuilder(definition).select(...columns);
    },
    limit: (count) => new BrowserModelQueryBuilder(definition).limit(count),
    take: (count) => new BrowserModelQueryBuilder(definition).take(count),
    skip: (count) => new BrowserModelQueryBuilder(definition).skip(count),
    latest: (column = "created_at") => new BrowserModelQueryBuilder(definition).latest(column),
    oldest: (column = "created_at") => new BrowserModelQueryBuilder(definition).oldest(column),
    async find(id) {
      return new BrowserModelQueryBuilder(definition).find(id);
    },
    async findOrFail(id) {
      return new BrowserModelQueryBuilder(definition).findOrFail(id);
    },
    async all() {
      return new BrowserModelQueryBuilder(definition).get();
    },
    async first() {
      return new BrowserModelQueryBuilder(definition).first();
    },
    async firstOrFail() {
      return new BrowserModelQueryBuilder(definition).firstOrFail();
    },
    async count() {
      return new BrowserModelQueryBuilder(definition).count();
    },
    async exists() {
      return new BrowserModelQueryBuilder(definition).exists();
    },
    async paginate(page, perPage) {
      return new BrowserModelQueryBuilder(definition).paginate(page, perPage);
    },
    async pluck(column) {
      return new BrowserModelQueryBuilder(definition).pluck(column);
    },
    async create(data) {
      const tablePath = typeof definition.traits?.useApi === "object" && definition.traits.useApi?.uri || definition.table;
      const url = `${browserConfig.baseUrl}/${tablePath}`;
      const body = browserConfig.transformRequest ? browserConfig.transformRequest(data) : data;
      const response = await fetch(url, {
        method: "POST",
        headers: await buildHeaders(),
        body: JSON.stringify(body)
      });
      const result = await handleResponse(response);
      const row = "data" in result && !Array.isArray(result.data) ? result.data : result;
      return new BrowserModelInstance(definition, row);
    },
    async update(id, data) {
      const tablePath = typeof definition.traits?.useApi === "object" && definition.traits.useApi?.uri || definition.table;
      const url = `${browserConfig.baseUrl}/${tablePath}/${id}`;
      const body = browserConfig.transformRequest ? browserConfig.transformRequest(data) : data;
      const response = await fetch(url, {
        method: "PATCH",
        headers: await buildHeaders(),
        body: JSON.stringify(body)
      });
      const result = await handleResponse(response);
      const row = "data" in result && !Array.isArray(result.data) ? result.data : result;
      return new BrowserModelInstance(definition, row);
    },
    async delete(id) {
      const tablePath = typeof definition.traits?.useApi === "object" && definition.traits.useApi?.uri || definition.table;
      const url = `${browserConfig.baseUrl}/${tablePath}/${id}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: await buildHeaders()
      });
      return response.ok;
    },
    async destroy(id) {
      return this.delete(id);
    },
    getDefinition: () => definition,
    getTable: () => definition.table
  };
  return new Proxy(model, {
    get(target, prop) {
      if (typeof prop === "string" && prop.startsWith("where") && prop.length > 5) {
        const columnPascal = prop.slice(5);
        const column = columnPascal.charAt(0).toLowerCase() + columnPascal.slice(1);
        if (column in definition.attributes || column === "id" || column === definition.primaryKey) {
          return (value) => new BrowserModelQueryBuilder(definition).where(column, value);
        }
      }
      return Reflect.get(target, prop);
    }
  });
}
var browserConfig, BrowserQueryError, browserAuth, browser_default;
var init_browser = __esm(() => {
  browserConfig = {
    baseUrl: ""
  };
  BrowserQueryError = class BrowserQueryError extends Error {
    status;
    constructor(message, status) {
      super(message);
      this.name = "BrowserQueryError";
      this.status = status;
    }
  };
  browserAuth = {
    async login(credentials) {
      const response = await fetch(`${browserConfig.baseUrl}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...browserConfig.headers
        },
        body: JSON.stringify(credentials)
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Login failed" }));
        throw new BrowserQueryError(error.message || "Login failed", response.status);
      }
      const rawData = await response.json();
      const data = rawData.data || rawData;
      if (typeof localStorage !== "undefined" && data.token) {
        localStorage.setItem("auth_token", data.token);
      }
      return data;
    },
    async register(data) {
      const response = await fetch(`${browserConfig.baseUrl}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...browserConfig.headers
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Registration failed" }));
        throw new BrowserQueryError(error.message || "Registration failed", response.status);
      }
      const rawResult = await response.json();
      const result = rawResult.data || rawResult;
      if (typeof localStorage !== "undefined" && result.token) {
        localStorage.setItem("auth_token", result.token);
      }
      return result;
    },
    async logout() {
      const token = await getAuthToken();
      if (token) {
        try {
          await fetch(`${browserConfig.baseUrl}/logout`, {
            method: "POST",
            headers: await buildHeaders()
          });
        } catch {}
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("auth_token");
      }
    },
    async user() {
      const token = await getAuthToken();
      if (!token)
        return null;
      try {
        const response = await fetch(`${browserConfig.baseUrl}/user`, {
          method: "GET",
          headers: await buildHeaders()
        });
        if (response.status === 401) {
          browserConfig.onUnauthorized?.();
          return null;
        }
        if (!response.ok)
          return null;
        const data = await response.json();
        return data.user || data;
      } catch {
        return null;
      }
    },
    async check() {
      const user = await this.user();
      return user !== null;
    },
    getToken: getAuthToken
  };
  browser_default = browserQuery;
});
init_browser();

export {
  isBrowser,
  getBrowserConfig,
  browser_default as default,
  createBrowserModel,
  createBrowserDb,
  configureBrowser,
  browserQuery,
  browserAuth,
  BrowserQueryError,
  BrowserQueryBuilder
};
