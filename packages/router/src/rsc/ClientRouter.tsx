import React, { useMemo } from 'react'

import { analyzeRoutes } from '../analyzeRoutes.js'
import { AuthenticatedRoute } from '../AuthenticatedRoute.js'
import { LocationProvider, useLocation } from '../location.js'
import { namedRoutes } from '../namedRoutes.js'
import { RouterContextProvider } from '../router-context.js'
import type { RouterProps } from '../router.js'

import { RscRoutes } from './RscRoutes.js'

export const Router = ({ useAuth, paramTypes, children }: RouterProps) => {
  return (
    // Wrap it in the provider so that useLocation can be used
    <LocationProvider>
      <LocationAwareRouter paramTypes={paramTypes} useAuth={useAuth}>
        {children}
      </LocationAwareRouter>
    </LocationProvider>
  )
}

const LocationAwareRouter = ({
  useAuth,
  paramTypes,
  children,
}: RouterProps) => {
  const { pathname, search } = useLocation()

  const analyzeRoutesResult = useMemo(() => {
    return analyzeRoutes(children, {
      currentPathName: pathname,
      userParamTypes: paramTypes,
    })
  }, [pathname, children, paramTypes])

  const { namedRoutesMap, pathRouteMap, activeRoutePath } = analyzeRoutesResult

  // Assign namedRoutes so it can be imported like import {routes} from 'rwjs/router'
  // Note that the value changes at runtime
  Object.assign(namedRoutes, namedRoutesMap)

  // No activeRoutePath basically means 404.
  // TODO (RSC): Add tests for this
  // TODO (RSC): Figure out how to handle this case better
  if (!activeRoutePath) {
    // throw new Error(
    //   'No route found for the current URL. Make sure you have a route ' +
    //     'defined for the root of your React app.',
    // )
    const routesProps = { location: { pathname, search } }
    return <RscRoutes routesProps={routesProps} />
  }

  const requestedRoute = pathRouteMap[activeRoutePath]

  // Need to reverse the sets array when finding the private set so that we
  // find the inner-most private set first. Otherwise we could end up
  // redirecting to the wrong route.
  // TODO (RSC): Add tests for finding the correct unauthenticated prop
  const reversedSets = requestedRoute.sets.toReversed()

  const privateSet = reversedSets.find((set) => set.isPrivate)

  if (privateSet) {
    const unauthenticated = privateSet.props.unauthenticated
    if (!unauthenticated || typeof unauthenticated !== 'string') {
      throw new Error(
        'You must specify an `unauthenticated` route when using PrivateSet',
      )
    }

    const routesProps = { location: { pathname, search } }

    return (
      <RouterContextProvider
        useAuth={useAuth}
        paramTypes={paramTypes}
        routes={analyzeRoutesResult}
        activeRouteName={requestedRoute.name}
      >
        <AuthenticatedRoute unauthenticated={unauthenticated}>
          <RscRoutes routesProps={routesProps} />
        </AuthenticatedRoute>
      </RouterContextProvider>
    )
  }

  const routesProps = { location: { pathname, search } }
  // TODO (RSC): I think that moving between private and public routes
  // re-initializes RscFetcher. I wonder if there's an optimization to be made
  // here. Maybe we can lift RscFetcher up so we can keep the same instance
  // around and reuse it everywhere
  return <RscRoutes routesProps={routesProps} />
}

export interface RscFetchProps extends Record<string, unknown> {
  location: {
    pathname: string
    search: string
  }
}
