/**
 * Location Service - Business Logic Layer
 * 
 * Sorumluluklar:
 * 1. Konum güncelleme iş mantığı
 * 2. Nearby users sorgusu (coğrafi hesaplamalar)
 * 3. Privacy kontrolü (isVisible)
 * 
 * Bu service, routes'tan çağrılır ve model ile konuşur.
 * Doğrudan HTTP request/response ile ilgilenmez.
 */

const UserLocation = require('../models/UserLocation');
const User = require('../models/User');

class LocationService {
  /**
   * Kullanıcının konumunu güncelle veya oluştur
   * 
   * @param {string} userId - Kullanıcı ID
   * @param {Object} locationData - Konum verisi
   * @returns {Promise<Object>} Güncellenmiş konum
   */
  async updateUserLocation(userId, locationData) {
    const {
      latitude,
      longitude,
      speed = null,
      heading = null,
      altitude = null,
      accuracy = null,
      isVisible = true,
      status = 'active'
    } = locationData;

    // Koordinat validasyonu (ekstra güvenlik)
    if (latitude < -90 || latitude > 90) {
      throw new Error('Invalid latitude value');
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error('Invalid longitude value');
    }

    const location = await UserLocation.findOneAndUpdate(
      { user: userId },
      {
        user: userId,
        location: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        speed,
        heading,
        altitude,
        accuracy,
        isVisible,
        status: isVisible ? status : 'hidden',
        lastSeenAt: new Date()
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    ).populate('user', 'username fullName profilePicture motorcycleInfo status');

    return location;
  }

  /**
   * Yakındaki kullanıcıları bul (Geospatial Query)
   * 
   * @param {number} latitude - Merkez latitude
   * @param {number} longitude - Merkez longitude
   * @param {number} radius - Yarıçap (metre)
   * @param {number} limit - Maksimum sonuç sayısı
   * @param {string} excludeUserId - Hariç tutulacak kullanıcı ID
   * @returns {Promise<Array>} Yakındaki kullanıcılar
   */
  async getNearbyUsers(latitude, longitude, radius, limit, excludeUserId) {
    // Koordinat validasyonu
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error('Invalid coordinates');
    }

    // MongoDB Geospatial Query
    // $near sorgusu 2dsphere index kullanır (PERFORMANCE!)
    const nearbyLocations = await UserLocation.find({
      user: { $ne: excludeUserId },
      isVisible: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: radius
        }
      }
    })
      .limit(limit)
      .populate('user', 'username fullName profilePicture motorcycleInfo status');

    return nearbyLocations;
  }

  /**
   * Kullanıcının görünürlüğünü değiştir
   * 
   * @param {string} userId - Kullanıcı ID
   * @param {boolean} isVisible - Görünürlük durumu
   * @returns {Promise<Object>} Güncellenmiş konum
   */
  async toggleVisibility(userId, isVisible) {
    const location = await UserLocation.findOneAndUpdate(
      { user: userId },
      {
        isVisible,
        status: isVisible ? 'active' : 'hidden',
        lastSeenAt: new Date()
      },
      { new: true }
    ).populate('user', 'username fullName profilePicture motorcycleInfo status');

    if (!location) {
      throw new Error('User location not found');
    }

    return location;
  }

  /**
   * Kullanıcının konumunu sil (privacy)
   * 
   * @param {string} userId - Kullanıcı ID
   * @returns {Promise<boolean>} Başarılı mı?
   */
  async deleteUserLocation(userId) {
    const result = await UserLocation.deleteOne({ user: userId });
    return result.deletedCount > 0;
  }

  /**
   * Kullanıcının kendi konumunu getir
   * 
   * @param {string} userId - Kullanıcı ID
   * @returns {Promise<Object|null>} Kullanıcı konumu
   */
  async getUserLocation(userId) {
    const location = await UserLocation.findOne({ user: userId })
      .populate('user', 'username fullName profilePicture motorcycleInfo status');

    return location;
  }

  /**
   * Takip edilen kullanıcıların konumlarını getir
   * 
   * @param {Array} followingIds - Takip edilen kullanıcı ID'leri
   * @param {boolean} includeSelf - Kendi konumunu da dahil et mi?
   * @param {string} selfId - Kendi kullanıcı ID
   * @returns {Promise<Array>} Konum listesi
   */
  async getFollowingLocations(followingIds, includeSelf = false, selfId = null) {
    const targetIds = [...followingIds];
    
    if (includeSelf && selfId) {
      targetIds.push(selfId);
    }

    const locations = await UserLocation.find({
      user: { $in: targetIds },
      isVisible: true
    })
      .sort({ updatedAt: -1 })
      .populate('user', 'username fullName profilePicture motorcycleInfo status');

    return locations;
  }
}

module.exports = new LocationService();
