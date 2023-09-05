import type { User } from '../client';
import type {
	AsyncApiIntrospector,
	CodeGen,
	S3UploadConfiguration,
	TokenAuthProvider,
	WunderGraphConfigApplicationConfig,
} from '../configure';
import type { AuthenticationProvider } from '../configure/authentication';
import type {
	BaseOperationConfiguration,
	MutationConfiguration,
	QueryConfiguration,
	SubscriptionConfiguration,
} from '../configure/operations';
import type { NodeOptions } from '../configure/options';
import type { ClientRequest, RequestLogger } from '../server';

export interface ConfigSetupOptions {
	addApi: (api: AsyncApiIntrospector<any>) => void;
	addAuthProvider: <Type extends AuthProviderTypes>(
		type: AuthProviderTypes,
		authProvider: AuthProviderConfig[Type]
	) => void;
	addS3Provider: (s3Provider: S3UploadConfiguration) => void;
	addCodeGeneration: (codeGen: CodeGen) => void;
}

export interface WunderGraphConfigWithAppConfig extends WunderGraphConfig {
	appConfig: WunderGraphConfigApplicationConfig<any, any>;
}

export interface WunderGraphAppConfig
	extends Omit<WunderGraphConfig, 'operations' | 'options' | 'authentication'>,
		WunderGraphConfigApplicationConfig<any, any> {}

export interface WunderGraphDatasourceHooks {
	'config:setup'?: (options: Pick<ConfigSetupOptions, 'addApi'>) => void;
}

export interface WunderGraphDatasource {
	name: string;
	hooks: WunderGraphIntegrationHooks;
}

export interface CustomContext {}

export interface GeneratedOperations {}

export interface HookContext {
	/**
	 * The user that is currently logged in.
	 */
	user?: User;
	/**
	 * The client request.
	 */
	clientRequest: ClientRequest;
	/**
	 * The request logger.
	 */
	log: RequestLogger;
	/**
	 * The operations client that is used to communicate with the server.
	 */
	// operations: Omit<InternalOperationsClient, 'cancelSubscriptions'>;
	/**
	 * Custom context
	 */
	context: CustomContext;
}

/**
 * HTTP transport hook context
 */
export interface HttpHookContext {
	request: Request;
	operation: {
		name: string;
		type: 'query' | 'mutation' | 'subscription';
	};
}

/**
 * Authentication hook context
 */
export interface AuthenticationHookContext {
	user: User;
}

export interface WunderGraphIntegrationHooks {
	'config:setup'?: (options: ConfigSetupOptions) => void;
	'config:generated'?: (config: WunderGraphConfigWithAppConfig) => void;
	'authentication:postAuthentication'?: (context: AuthenticationHookContext) => User | Promise<User>;
}

export interface WunderGraphIntegration {
	name: string;
	hooks: WunderGraphIntegrationHooks;
}

export interface WunderGraphEnterpriseIntegrationHooks {
	'http:transport'?: <Context>(context: Context) => void;
}

export interface InternalIntegration {
	name: string;
	hooks: WunderGraphIntegrationHooks & WunderGraphEnterpriseIntegrationHooks;
}

export interface InternalMatcher {
	operationType: 'query' | 'mutation' | 'subscription';
}

export interface InternalHookConfig {
	match: InternalMatcher | InternalMatcher[];
	handler: (context: any) => Promise<Response>;
}

export type AuthProviderTypes = 'tokenBased' | 'cookieBased';
export type AuthProviderConfig = {
	cookieBased: AuthenticationProvider;
	tokenBased: TokenAuthProvider;
};

export type WunderGraphNodeOptions = Pick<NodeOptions, 'defaultHttpProxyUrl' | 'defaultRequestTimeoutSeconds'>;

/**
 * Customize configuration for queries, mutations and subscriptions
 *
 * @see Docs https://docs.wundergraph.com/docs/wundergraph-operations-ts-reference/custom-operations-configuration
 */
export interface CustomOperationsConfiguration {}

/**
 * Configuration for queries, mutations and subscriptions
 *
 * @see Docs https://docs.wundergraph.com/docs/wundergraph-operations-ts-reference
 */
export interface WunderGraphConfigOperations {
	defaultConfig?: BaseOperationConfiguration;
	queries?: QueryConfiguration;
	mutations?: MutationConfiguration;
	subscriptions?: SubscriptionConfiguration;
	custom?: CustomOperationsConfiguration;
}

export interface WunderGraphConfig
	extends Pick<WunderGraphConfigApplicationConfig<any, any>, 'cors' | 'experimental' | 'security' | 'authorization'> {
	datasources: WunderGraphDatasource[];
	integrations?: WunderGraphIntegration[];
	authentication?: WunderGraphAuthenticationConfig;
	options?: WunderGraphNodeOptions;
	operations?: WunderGraphConfigOperations;
}

export interface WunderGraphAuthenticationConfig {
	providers: WunderGraphIntegration[];
	redirectUris?: string[];
}
