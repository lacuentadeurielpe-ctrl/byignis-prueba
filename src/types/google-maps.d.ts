declare global {
  namespace google.maps.places {
    interface AutocompleteSessionToken {}
    interface AutocompleteService {
      getPlacePredictions(
        request: {
          input: string
          componentRestrictions?: { country?: string | string[] }
          sessionToken?: AutocompleteSessionToken
        },
        callback: (
          predictions: AutocompletePrediction[] | null,
          status: PlacesServiceStatus
        ) => void
      ): void
    }
    interface PlacesService {
      getDetails(
        request: {
          placeId: string
          fields: string[]
          sessionToken?: AutocompleteSessionToken
        },
        callback: (place: PlaceResult | null, status: PlacesServiceStatus) => void
      ): void
    }
    interface AutocompletePrediction {
      description: string
      main_text: string
      secondary_text: string
      place_id: string
      reference: string
      types: string[]
    }
    interface PlaceResult {
      formatted_address?: string
      geometry?: {
        location: {
          lat(): number
          lng(): number
        }
      }
      place_id?: string
      types?: string[]
    }
    enum PlacesServiceStatus {
      OK = 'OK',
      ZERO_RESULTS = 'ZERO_RESULTS',
      NOT_FOUND = 'NOT_FOUND',
      MAX_WAYPOINTS_EXCEEDED = 'MAX_WAYPOINTS_EXCEEDED',
      MAX_ROUTE_LENGTH_EXCEEDED = 'MAX_ROUTE_LENGTH_EXCEEDED',
      INVALID_REQUEST = 'INVALID_REQUEST',
      OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
      REQUEST_DENIED = 'REQUEST_DENIED',
      UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    }
  }

  interface Window {
    google: any
  }
}

export {}
