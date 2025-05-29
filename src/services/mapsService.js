const { Client } = require('@googlemaps/google-maps-services-js');

class MapsService {
  constructor() {
    this.client = new Client({});
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  async geocode(address) {
    try {
      const response = await this.client.geocode({
        params: {
          address,
          key: this.apiKey
        }
      });

      if (response.data.results.length > 0) {
        const result = response.data.results[0];
        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          formattedAddress: result.formatted_address
        };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  async reverseGeocode(lat, lng) {
    try {
      const response = await this.client.reverseGeocode({
        params: {
          latlng: `${lat},${lng}`,
          key: this.apiKey
        }
      });

      if (response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw error;
    }
  }

  async getDirections(origin, destination, waypoints = []) {
    try {
      const response = await this.client.directions({
        params: {
          origin,
          destination,
          waypoints: waypoints.map(point => `via:${point}`),
          key: this.apiKey
        }
      });

      if (response.data.routes.length > 0) {
        const route = response.data.routes[0];
        return {
          distance: route.legs[0].distance.text,
          duration: route.legs[0].duration.text,
          steps: route.legs[0].steps.map(step => ({
            instruction: step.html_instructions,
            distance: step.distance.text,
            duration: step.duration.text
          }))
        };
      }
      return null;
    } catch (error) {
      console.error('Directions error:', error);
      throw error;
    }
  }

  async searchNearbyPlaces(lat, lng, type, radius = 5000) {
    try {
      const response = await this.client.placesNearby({
        params: {
          location: `${lat},${lng}`,
          radius,
          type,
          key: this.apiKey
        }
      });

      return response.data.results.map(place => ({
        name: place.name,
        address: place.vicinity,
        location: place.geometry.location,
        rating: place.rating,
        types: place.types
      }));
    } catch (error) {
      console.error('Places search error:', error);
      throw error;
    }
  }
}

module.exports = new MapsService(); 