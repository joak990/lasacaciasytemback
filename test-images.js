const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

async function testImages() {
  console.log('🧪 Probando sistema de múltiples imágenes...');
  
  try {
    // 1. Obtener todas las cabañas
    console.log('\n📋 Obteniendo cabañas...');
    const cabinsResponse = await axios.get(`${API_BASE_URL}/cabins`);
    const cabins = cabinsResponse.data;
    
    if (cabins.length === 0) {
      console.log('❌ No hay cabañas para probar');
      return;
    }
    
    const cabinId = cabins[0].id;
    console.log('✅ Cabaña encontrada:', cabins[0].name);
    
    // 2. Agregar imágenes de ejemplo
    console.log('\n📸 Agregando imágenes de ejemplo...');
    const sampleImages = [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800'
    ];
    
    const addImagesResponse = await axios.post(`${API_BASE_URL}/cabins/${cabinId}/images`, {
      images: sampleImages
    });
    
    console.log('✅ Imágenes agregadas:', addImagesResponse.data.message);
    
    // 3. Obtener imágenes de la cabaña
    console.log('\n🖼️ Obteniendo imágenes...');
    const getImagesResponse = await axios.get(`${API_BASE_URL}/cabins/${cabinId}/images`);
    const images = getImagesResponse.data.images;
    
    console.log('✅ Imágenes obtenidas:', images.length);
    images.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });
    
    // 4. Obtener cabaña completa con imágenes
    console.log('\n🏠 Obteniendo cabaña completa...');
    const cabinResponse = await axios.get(`${API_BASE_URL}/cabins/${cabinId}`);
    const cabin = cabinResponse.data;
    
    console.log('✅ Cabaña con imágenes:', {
      name: cabin.name,
      imagesCount: cabin.images.length,
      images: cabin.images
    });
    
    console.log('\n🎉 ¡Sistema de imágenes funcionando correctamente!');
    
  } catch (error) {
    console.error('❌ Error probando imágenes:', error.response?.data || error.message);
  }
}

testImages(); 