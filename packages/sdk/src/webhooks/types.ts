import { ClientRequest, OperationsClient, RequestLogger } from '../server';
import { RequestMethod } from '../server/types';
import { WebhookVerifierKind } from './verifiers';
import { EnvironmentVariable } from '../configure/variables';

export interface Webhook<
	Event extends WebhookHttpEvent = WebhookHttpEvent,
	Response extends WebhookHttpResponse = WebhookHttpResponse,
	TOperationsClient extends OperationsClient = OperationsClient,
	TypedORM = any
> {
	handler: (event: Event, context: WebhookRequestContext<TOperationsClient, TypedORM>) => Promise<Response>;
}
export interface WebhookHttpResponse<ResponseBody = unknown, Headers extends WebhookHeaders = WebhookHeaders> {
	statusCode?: number;
	body?: ResponseBody;
	headers?: Headers;
}
export type WebhookHeaders = Record<string, string>;
export type WebhookQuery = Record<string, string | string[]>;
export interface WebhookRequestContext<
	TOperationsClient extends OperationsClient = OperationsClient,
	TCustomContext = any,
	TypedORM = any
> {
	/**
	 * HTTP client request
	 */
	clientRequest: ClientRequest;
	/**
	 * The logger is used to log messages.
	 */
	log: RequestLogger;
	/**
	 * The operations client is used to make requests to the WunderGraph API.
	 */
	operations: TOperationsClient;
	/**
	 * Custom context
	 */
	context: TCustomContext;

	graph: TypedORM;
}
export interface WebhookHttpEvent<
	Body = unknown,
	Query extends WebhookQuery = WebhookQuery,
	Headers extends WebhookHeaders = WebhookHeaders
> {
	method: RequestMethod;
	url: string;
	headers: Headers;
	query: Query;
	body: Body;
}

export interface WebhookConfiguration {
	verifier: {
		kind: WebhookVerifierKind;
		secret: EnvironmentVariable;
		signatureHeader: string;
		signatureHeaderPrefix: string;
	};
}

export interface WebhooksConfig {
	[name: string]: WebhookConfiguration;
}
