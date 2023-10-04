import { CodeGenerationConfig, GraphQLOperation, Template, TemplateOutputFile } from '@wundergraph/sdk';
import { hasInput, visitJSONSchema } from '@wundergraph/sdk/internal/codegen';
import { JSONSchema7 as JSONSchema, JSONSchema7 } from 'json-schema';
import execa from 'execa';
import { capitalize } from 'lodash';
import Handlebars from 'handlebars';
import { clientTemplate } from './client-template';
import { OperationExecutionEngine, OperationType } from '@wundergraph/protobuf';
import Logger from '@wundergraph/sdk/internal/logger';

const logger = Logger.child({ plugin: 'golang-client' });

const golangHeader = (packageName: string) =>
	`// Code generated by wunderctl. DO NOT EDIT.\npackage ${packageName}\n\n`;

export interface GolangClientTemplateConfig {
	packageName: string;
}

const defaultTemplateConfig: GolangClientTemplateConfig = {
	packageName: 'client',
};

/**
 * Formats a given string with each line prepended by its line number
 * (starting at 1).
 *
 * @remarks
 * Lines are split by \r?\n, then joined by \n
 *
 * @param code - The code to split and prepend line numbers to
 * @returns A string with the line annotated code
 */
function linefy(code: string): string {
	return code
		.split(/\r?\n/)
		.map((line, idx) => `${idx + 1}: ${line}`)
		.join('\n');
}

const gofmt = (code: string) => {
	try {
		// check if gofmt is installed
		const formatter = execa.sync('gofmt', {
			input: code,
			encoding: 'utf8',
		});
		if (formatter.exitCode === 0) {
			return formatter.stdout;
		}
	} catch (e: any) {
		// If the error is due to gofmt not being installed, we ignore it
		// on purpose. Otherwise we throw an error with both the code and
		// the error message returned by gofmt.
		if (e instanceof Error && e.message.indexOf('ENOENT') >= 0) {
			logger.warn('gofmt is not installed. If you want to prettify the generated code, please install gofmt');
		} else {
			throw new Error(`failed to format:\n${linefy(code)}\n\n${e}`);
		}
	}
	return code;
};

export class GolangInputModels implements Template {
	constructor(config: GolangClientTemplateConfig = Object.assign({}, defaultTemplateConfig)) {
		this.config = config;
	}

	private readonly config: GolangClientTemplateConfig;

	async generate(generationConfig: CodeGenerationConfig): Promise<TemplateOutputFile[]> {
		const content = generationConfig.config.application.Operations.filter(hasInput)
			.map((op) => JSONSchemaToGolangStruct(op.VariablesSchema, op.Name + 'Input', false))
			.join('\n\n');
		return Promise.resolve([
			{
				path: 'models.go',
				content: gofmt(content),
				header: golangHeader(this.config.packageName),
			},
		]);
	}

	dependencies(): Template[] {
		return [new GolangModelsBase()];
	}
}

export class GolangResponseModels implements Template {
	constructor(config: GolangClientTemplateConfig = Object.assign({}, defaultTemplateConfig)) {
		this.config = config;
	}

	private readonly config: GolangClientTemplateConfig;

	generate(generationConfig: CodeGenerationConfig): Promise<TemplateOutputFile[]> {
		const config = generationConfig.config;
		const content = config.application.Operations.map((op) => {
			const dataName = '#/definitions/' + op.Name + 'ResponseData';
			const responseSchema: JSONSchema = {
				type: 'object',
				properties: {
					data: {
						$ref: dataName,
					},
				},
			};
			return JSONSchemaToGolangStruct(responseSchema, op.Name + 'Response', true);
		}).join('\n\n');
		return Promise.resolve([
			{
				path: 'models.go',
				content: gofmt(content),
				header: golangHeader(this.config.packageName),
			},
		]);
	}

	dependencies(): Template[] {
		return [new GolangModelsBase(), new GolangResponseDataModels(this.config), new GolangBaseDataModel(this.config)];
	}
}

const responseDataSchema = (op: GraphQLOperation) => {
	switch (op.ExecutionEngine) {
		case OperationExecutionEngine.ENGINE_NODEJS:
			return op.ResponseSchema;
		case OperationExecutionEngine.ENGINE_GRAPHQL:
			return op.ResponseSchema?.properties?.['data'] as JSONSchema7;
	}
	throw new Error(`unhandled operation engine ${op.ExecutionEngine}`);
};

export class GolangResponseDataModels implements Template {
	constructor(config: GolangClientTemplateConfig = Object.assign({}, defaultTemplateConfig)) {
		this.config = config;
	}

	private readonly config: GolangClientTemplateConfig;

	generate(generationConfig: CodeGenerationConfig): Promise<TemplateOutputFile[]> {
		const content = generationConfig.config.application.Operations.filter((op) => responseDataSchema(op) !== undefined)
			.map((op) => JSONSchemaToGolangStruct(responseDataSchema(op), op.Name + 'ResponseData', false))
			.join('\n\n');
		return Promise.resolve([
			{
				path: 'models.go',
				content: gofmt(content),
				header: golangHeader(this.config.packageName),
			},
		]);
	}
}

export class GolangBaseDataModel implements Template {
	constructor(config: GolangClientTemplateConfig = Object.assign({}, defaultTemplateConfig)) {
		this.config = config;
	}

	private readonly config: GolangClientTemplateConfig;

	generate(generationConfig: CodeGenerationConfig): Promise<TemplateOutputFile[]> {
		const definitions: Map<string, JSONSchema7> = new Map();

		generationConfig.config.application.Operations.forEach((op) => {
			if (!op.VariablesSchema.definitions) {
				return;
			}
			Object.keys(op.VariablesSchema.definitions).forEach((definitionName) => {
				if (definitions.has(definitionName)) {
					return;
				}
				const definition = op.VariablesSchema.definitions![definitionName];
				if (typeof definition !== 'object') {
					return;
				}
				definitions.set(definitionName, definition);
			});
		});

		const content = Array.from(definitions.entries())
			.map(([definitionName, definition]) => JSONSchemaToGolangStruct(definition, definitionName, false))
			.join('\n\n');

		return Promise.resolve([
			{
				path: 'models.go',
				content: gofmt(content),
				header: golangHeader(this.config.packageName),
			},
		]);
	}
}

const golangModelsBase = `
type GraphQLError struct {
	Message string
	Path    []interface{}
}`;

export class GolangModelsBase implements Template {
	async generate(config: CodeGenerationConfig): Promise<TemplateOutputFile[]> {
		return Promise.resolve([
			{
				path: 'models.go',
				content: gofmt(golangModelsBase),
			},
		]);
	}

	dependencies(): Template[] {
		return [];
	}
}

export class GolangClient implements Template {
	constructor(config: GolangClientTemplateConfig = Object.assign({}, defaultTemplateConfig)) {
		this.config = config;
	}

	private readonly config: GolangClientTemplateConfig;

	async generate(generationConfig: CodeGenerationConfig): Promise<TemplateOutputFile[]> {
		const config = generationConfig.config;
		const tmpl = Handlebars.compile(clientTemplate);
		const content = tmpl({
			queries: config.application.Operations.filter((op) => op.OperationType === OperationType.QUERY).map((op) => ({
				name: op.Name,
				hasInput: hasInput(op),
			})),
			mutations: config.application.Operations.filter((op) => op.OperationType === OperationType.MUTATION).map(
				(op) => ({ name: op.Name, hasInput: hasInput(op) })
			),
			subscriptions: config.application.Operations.filter((op) => op.OperationType === OperationType.SUBSCRIPTION).map(
				(op) => ({ name: op.Name, hasInput: hasInput(op) })
			),
			baseURL: config.deployment.environment.baseUrl,
		});

		return Promise.resolve([
			{
				path: 'client.go',
				content: gofmt(content),
				header: golangHeader(this.config.packageName),
			},
		]);
	}
}

const JSONSchemaToGolangStruct = (schema: JSONSchema, structName: string, withErrors: boolean): string => {
	let out = '';
	const capitalizeFirstChar = (name: string) => capitalize(name.substring(0, 1)) + name.substring(1);
	const addJsonTag = (fieldName: string, isArray: boolean) => {
		out += ` \`json:"${fieldName},omitempty"\`\n`;
	};
	visitJSONSchema(schema, {
		root: {
			enter: () => {
				out += `type ${capitalizeFirstChar(structName)} struct {\n`;
			},
			leave: () => {
				if (withErrors) {
					out += `\terrors []GraphQLError \`json:"errors"\``;
				}
				out += '\n}\n';
			},
		},
		number: (name, isRequired, isArray) => {
			out += `\t${capitalizeFirstChar(name)} ${isArray ? '[]' : ''}${isRequired ? '' : '*'}float64`;
			addJsonTag(name, isArray);
		},
		array: {
			enter: (name, isRequired, isArray) => {
				out += `\t${capitalizeFirstChar(name)}`;
			},
		},
		string: (name, isRequired, isArray, enumValues) => {
			out += `\t${capitalizeFirstChar(name)} ${isArray ? '[]' : ''}${isRequired ? '' : '*'}string`;
			addJsonTag(name, isArray);
		},
		object: {
			enter: (name, isRequired, isArray) => {
				out += `\t${capitalizeFirstChar(name)} ${isArray ? '[]' : ''}${isRequired ? '' : '*'}struct {\n`;
			},
			leave: (name, isRequired, isArray) => {
				out += `\t}`;
				addJsonTag(name, isArray);
			},
		},
		boolean: (name, isRequired, isArray) => {
			out += `\t${capitalizeFirstChar(name)} ${isArray ? '[]' : ''}${isRequired ? '' : '*'}bool`;
			addJsonTag(name, isArray);
		},
		any: (name, isRequired, isArray) => {
			out += `\t${capitalizeFirstChar(name)} ${isArray ? '[]' : ''}${isRequired ? '' : '*'}interface{}`;
			addJsonTag(name, isArray);
		},
		customType: (name, typeName, isRequired, isArray) => {
			if (typeName.indexOf('{') >= 0) {
				// Anonymous type not representable by Go
				// TODO: Do beter with these at some point, use an approach like the Rust generator
				typeName = `interface{}`;
			} else {
				typeName = capitalizeFirstChar(typeName);
			}
			out += `\t${capitalizeFirstChar(name)} ${isArray ? '[]' : ''} ${isRequired ? '' : '*'}${typeName}`;
			addJsonTag(name, isArray);
		},
	});
	return out;
};

/* 
	-------------------------------------
	Dependencies
	-------------------------------------
	GolangModelsBase => BaseTypeScriptDataModel + TypeScriptEnumModels ===> models.go
	GolangInputModels => GolangModelsBase ===> models.go
	GolangResponseModels => GolangModelsBase + GolangResponseDataModels + GolangBaseDataModels ===> models.go
	GolangClient => None ===> client.go
*/

export const golangClient = {
	all: (config: GolangClientTemplateConfig = defaultTemplateConfig) => [
		new GolangInputModels(config),
		new GolangResponseModels(config),
		new GolangClient(config),
	],
};
