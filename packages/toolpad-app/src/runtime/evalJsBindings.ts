import { set } from 'lodash-es';

let iframe: HTMLIFrameElement;
function evaluateCode(code: string, globalScope: Record<string, unknown>) {
  // TODO: investigate https://www.npmjs.com/package/ses
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');
    iframe.style.display = 'none';
    document.documentElement.appendChild(iframe);
  }

  // eslint-disable-next-line no-underscore-dangle
  (iframe.contentWindow as any).__SCOPE = globalScope;
  return (iframe.contentWindow as any).eval(`with (window.__SCOPE) { ${code} }`);
}

const TOOLPAD_LOADING_MARKER = '__TOOLPAD_LOADING_MARKER__';

function evaluateExpression(
  code: string,
  globalScope: Record<string, unknown>,
): BindingEvaluationResult {
  try {
    const value = evaluateCode(code, globalScope);
    return { value };
  } catch (error: any) {
    if (error?.message === TOOLPAD_LOADING_MARKER) {
      return { loading: true };
    }
    return { error: error as Error };
  }
}

function unwrapEvaluationResult(result: BindingEvaluationResult) {
  if (result.loading) {
    throw new Error(TOOLPAD_LOADING_MARKER);
  } else if (result.error) {
    throw result.error;
  } else {
    return result.value;
  }
}

/**
 * Represents the actual state of an evaluated binding.
 */
export type BindingEvaluationResult<T = unknown> = {
  /**
   * The actual value.
   */
  value?: T;
  /**
   * The evaluation of the value resulted in error.
   */
  error?: Error;
  /**
   * The parts that this value depends on are still loading.
   */
  loading?: boolean;
};

/**
 * Represents the state of a binding. It both describes which place it takes in the gobal scope
 * and how to obtain the result
 */
export interface ParsedBinding<T = unknown> {
  /**
   * How this binding presents itself to expressions in the global scope.
   * Path in the form that is accepted by lodash.set
   */
  scopePath?: string;
  /**
   * javascript expression that evaluates to the value of this binding
   */
  expression?: string;
  /**
   * actual evaluated result of the binding
   */
  result?: BindingEvaluationResult<T>;
}

export function buildGlobalScope(bindings: Record<string, ParsedBinding>): Record<string, unknown> {
  const globalScope = {};
  for (const binding of Object.values(bindings)) {
    if (binding.scopePath) {
      const value = binding.result?.value;
      set(globalScope, binding.scopePath, value);
    }
  }
  return globalScope;
}

/**
 * Evaluates the expressions and replace with their result
 */
export default function evalJsBindings(
  bindings: Record<string, ParsedBinding>,
): Record<string, ParsedBinding> {
  const bindingsMap = new Map(Object.entries(bindings));

  const bindingIdMap = new Map<string, string>();
  for (const [bindingId, binding] of bindingsMap) {
    if (binding.scopePath) {
      bindingIdMap.set(binding.scopePath, bindingId);
    }
  }

  const computationStatuses = new Map<string, { result: null | BindingEvaluationResult }>();

  let proxiedScope: Record<string, unknown>;

  const proxify = (obj: Record<string, unknown>, label?: string): Record<string, unknown> =>
    new Proxy(obj, {
      get(target, prop, receiver) {
        if (typeof prop === 'symbol') {
          return Reflect.get(target, prop, receiver);
        }

        const scopePath = label ? `${label}.${prop}` : prop;
        const bindingId = bindingIdMap.get(scopePath);
        const binding = bindingId && bindingsMap.get(bindingId);

        if (binding) {
          const expression = binding.expression;

          if (expression) {
            const computed = computationStatuses.get(expression);
            if (computed) {
              if (computed.result) {
                // From cache
                return unwrapEvaluationResult(computed.result);
              }

              throw new Error(`Cycle detected "${scopePath}"`);
            }

            // use null to mark as "computing"
            computationStatuses.set(expression, { result: null });
            const result = evaluateExpression(expression, proxiedScope);
            computationStatuses.set(expression, { result });
            // From freshly computed
            return unwrapEvaluationResult(result);
          }

          if (binding.result) {
            // From input value on the page
            return unwrapEvaluationResult(binding.result);
          }
        }

        const result = target[prop];

        if (result && typeof result === 'object') {
          return proxify(result as Record<string, unknown>, scopePath);
        }

        return Reflect.get(target, prop, receiver);
      },
    });

  const scope = buildGlobalScope(bindings);
  proxiedScope = proxify(scope);

  return Object.fromEntries(
    Object.entries(bindings).map(([bindingId, binding]) => {
      const { expression, result, ...rest } = binding;
      return [
        bindingId,
        {
          ...rest,
          result: expression
            ? evaluateExpression(expression, proxiedScope)
            : result || { value: undefined },
        },
      ];
    }),
  );
}
