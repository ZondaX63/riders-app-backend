const mapsService = require('../src/services/mapsService');

// Mock the Google Maps client
jest.mock('@googlemaps/google-maps-services-js', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      geocode: jest.fn(),
      reverseGeocode: jest.fn(),
      directions: jest.fn(),
      placesNearby: jest.fn()
    }))
  };
});

describe('Maps Service Tests', () => {
  let mockClient;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockClient = mapsService.client;
  });

  describe('Geocoding', () => {
    it('should successfully geocode an address', async () => {
      const mockResponse = {
        data: {
          results: [{
            geometry: {
              location: {
                lat: 41.0082,
                lng: 28.9784
              }
            },
            formatted_address: 'Istanbul, Turkey'
          }]
        }
      };

      mockClient.geocode.mockResolvedValueOnce(mockResponse);

      const result = await mapsService.geocode('Istanbul, Turkey');

      expect(result).toEqual({
        lat: 41.0082,
        lng: 28.9784,
        formattedAddress: 'Istanbul, Turkey'
      });
      expect(mockClient.geocode).toHaveBeenCalledWith({
        params: {
          address: 'Istanbul, Turkey',
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });
    });

    it('should return null for non-existent address', async () => {
      const mockResponse = {
        data: {
          results: []
        }
      };

      mockClient.geocode.mockResolvedValueOnce(mockResponse);

      const result = await mapsService.geocode('NonExistentPlace123');

      expect(result).toBeNull();
    });

    it('should handle geocoding errors', async () => {
      mockClient.geocode.mockRejectedValueOnce(new Error('API Error'));

      await expect(mapsService.geocode('Istanbul, Turkey')).rejects.toThrow('API Error');
    });
  });

  describe('Reverse Geocoding', () => {
    it('should successfully reverse geocode coordinates', async () => {
      const mockResponse = {
        data: {
          results: [{
            formatted_address: 'Istanbul, Turkey'
          }]
        }
      };

      mockClient.reverseGeocode.mockResolvedValueOnce(mockResponse);

      const result = await mapsService.reverseGeocode(41.0082, 28.9784);

      expect(result).toBe('Istanbul, Turkey');
      expect(mockClient.reverseGeocode).toHaveBeenCalledWith({
        params: {
          latlng: '41.0082,28.9784',
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });
    });

    it('should return null for invalid coordinates', async () => {
      const mockResponse = {
        data: {
          results: []
        }
      };

      mockClient.reverseGeocode.mockResolvedValueOnce(mockResponse);

      const result = await mapsService.reverseGeocode(999, 999);

      expect(result).toBeNull();
    });

    it('should handle reverse geocoding errors', async () => {
      mockClient.reverseGeocode.mockRejectedValueOnce(new Error('API Error'));

      await expect(mapsService.reverseGeocode(41.0082, 28.9784)).rejects.toThrow('API Error');
    });
  });

  describe('Directions', () => {
    it('should successfully get directions', async () => {
      const mockResponse = {
        data: {
          routes: [{
            legs: [{
              distance: { text: '450 km', value: 450000 },
              duration: { text: '5 hours', value: 18000 },
              steps: [
                { html_instructions: 'Head north', distance: { text: '100 km' } },
                { html_instructions: 'Turn right', distance: { text: '350 km' } }
              ]
            }]
          }]
        }
      };

      mockClient.directions.mockResolvedValueOnce(mockResponse);

      const result = await mapsService.getDirections('Istanbul', 'Ankara');

      expect(result).toEqual({
        distance: '450 km',
        duration: '5 hours',
        steps: [
          { instruction: 'Head north', distance: '100 km' },
          { instruction: 'Turn right', distance: '350 km' }
        ]
      });
      expect(mockClient.directions).toHaveBeenCalledWith({
        params: {
          origin: 'Istanbul',
          destination: 'Ankara',
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });
    });

    it('should return null for invalid route', async () => {
      const mockResponse = {
        data: {
          routes: []
        }
      };

      mockClient.directions.mockResolvedValueOnce(mockResponse);

      const result = await mapsService.getDirections('Invalid', 'Invalid');

      expect(result).toBeNull();
    });

    it('should handle directions errors', async () => {
      mockClient.directions.mockRejectedValueOnce(new Error('API Error'));

      await expect(mapsService.getDirections('Istanbul', 'Ankara')).rejects.toThrow('API Error');
    });
  });

  describe('Nearby Places', () => {
    it('should successfully find nearby places', async () => {
      const mockResponse = {
        data: {
          results: [{
            name: 'Test Restaurant',
            vicinity: 'Test Street',
            geometry: {
              location: {
                lat: 41.0082,
                lng: 28.9784
              }
            },
            rating: 4.5,
            types: ['restaurant']
          }]
        }
      };

      mockClient.placesNearby.mockResolvedValueOnce(mockResponse);

      const result = await mapsService.searchNearbyPlaces(41.0082, 28.9784, 'restaurant');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'Test Restaurant',
        address: 'Test Street',
        location: {
          lat: 41.0082,
          lng: 28.9784
        },
        rating: 4.5,
        types: ['restaurant']
      });
      expect(mockClient.placesNearby).toHaveBeenCalledWith({
        params: {
          location: '41.0082,28.9784',
          radius: 5000,
          type: 'restaurant',
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });
    });

    it('should handle nearby places errors', async () => {
      mockClient.placesNearby.mockRejectedValueOnce(new Error('API Error'));

      await expect(mapsService.searchNearbyPlaces(41.0082, 28.9784, 'restaurant')).rejects.toThrow('API Error');
    });
  });
}); 