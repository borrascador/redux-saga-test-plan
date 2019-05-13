// @flow
import inspect from 'util-inspect';
import isMatch from 'lodash.ismatch';
import isEqual from 'lodash.isequal';
import SagaTestError from '../shared/SagaTestError';
import type ArraySet from '../utils/ArraySet';
import serializeEffect from '../shared/serializeEffect';
import reportActualEffects from './reportActualEffects';

type ExpectationThunkArgs = {
  storeState: mixed,
  returnValue: mixed,
  errorValue: mixed,
};

export type Expectation = ExpectationThunkArgs => void;

type EffectExpectationArgs = {
  effectName: string,
  expectedEffect: mixed,
  storeKey: string,
  like: boolean,
  extractEffect: Function,
  store: ArraySet<mixed>,
  expected: boolean,
};

export function createEffectExpectation({
  effectName,
  expectedEffect,
  storeKey,
  like,
  extractEffect,
  store,
  expected,
}: EffectExpectationArgs): Expectation {
  return () => {
    const deleted = like
      ? store.deleteBy(item => isMatch(extractEffect(item), expectedEffect))
      : store.delete(expectedEffect);

    let errorMessage = '';

    if (deleted && !expected) {
      const serializedEffect = serializeEffect(expectedEffect, storeKey);

      errorMessage =
        `\n${effectName} expectation unmet:` +
        `\n\nNot Expected\n------------\n${serializedEffect}\n`;

      throw new SagaTestError(errorMessage);
    } else if (!deleted && expected) {
      const serializedEffect = serializeEffect(expectedEffect, storeKey);

      errorMessage =
        `\n${effectName} expectation unmet:` +
        `\n\nExpected\n--------\n${serializedEffect}\n`;

      errorMessage += reportActualEffects(store, storeKey, effectName);
      throw new SagaTestError(errorMessage);
    }
  };
}

type ReturnExpectationArgs = {
  value: mixed,
  expected: boolean,
};

export function createReturnExpectation({
  value,
  expected,
}: ReturnExpectationArgs): Expectation {
  return ({ returnValue }: ExpectationThunkArgs) => {
    if (expected && !isEqual(value, returnValue)) {
      expect(returnValue).toEqual(value);
    } else if (!expected && isEqual(value, returnValue)) {
      expect(returnValue).not.toEqual(value);
    }
  };
}

type StoreStateExpectationArgs = {
  state: mixed,
  expected: boolean,
};

export function createStoreStateExpectation({
  state: expectedState,
  expected,
}: StoreStateExpectationArgs): Expectation {
  return ({ storeState }: ExpectationThunkArgs) => {
    if (expected && !isEqual(expectedState, storeState)) {
      expect(storeState).toEqual(expectedState);
    } else if (!expected && isEqual(expectedState, storeState)) {
      expect(storeState).not.toEqual(expectedState);
    }
  };
}

type ErrorExpectationArgs = {
  type: mixed,
  expected: boolean,
};

export function createErrorExpectation({
  type,
  expected,
}: ErrorExpectationArgs): Expectation {
  return ({ errorValue }: ExpectationThunkArgs) => {
    let serializedExpected = typeof type;

    if (typeof type === 'object') {
      serializedExpected = inspect(type, { depth: 3 });
    } else if (typeof type === 'function') {
      serializedExpected = type.name;
    }

    const matches = () =>
      (typeof type === 'object' && isEqual(type, errorValue)) ||
      (typeof type === 'function' && errorValue instanceof type);

    if (!expected) {
      if (typeof errorValue === 'undefined' || !matches()) return;

      throw new SagaTestError(`
Expected not to throw:
----------------------
${serializedExpected}
`);
    } else if (typeof errorValue === 'undefined') {
      throw new SagaTestError(`
Expected to thow:
-------------------
${serializedExpected}

But no error thrown
---------------------
`);
    } else if (typeof type === 'object' && !matches()) {
      const serializedActual = inspect(errorValue, { depth: 3 });
      throw new SagaTestError(`
Expected to throw:
-------------------
${serializedExpected}

But instead threw:
---------------------
${serializedActual}
`);
    } else if (typeof type === 'function' && !matches()) {
      const serializedActual =
        typeof errorValue === 'function'
          ? errorValue.constructor.name
          : typeof errorValue;

      throw new SagaTestError(`
Expected to throw error of type:
--------------------------------
${serializedExpected}

But instead threw:
--------------------------------
${serializedActual}
`);
    }
  };
}
