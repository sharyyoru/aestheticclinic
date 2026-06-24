const sharp = require('sharp');
const path = require('path');

async function generateIcon() {
  const inputPath = path.join(__dirname, '..', 'public', 'logos', 'aliice-logo.png');
  const outputPath = path.join(__dirname, 'assets', 'icon.png');
  const splashPath = path.join(__dirname, 'assets', 'splash.png');
  const adaptivePath = path.join(__dirname, 'assets', 'adaptive-icon.png');

  // Get original image dimensions
  const metadata = await sharp(inputPath).metadata();
  console.log('Original size:', metadata.width, 'x', metadata.height);

  // Create 1024x1024 icon with logo centered and white background
  const iconSize = 1024;
  const padding = 200; // Padding around logo
  const logoMaxWidth = iconSize - (padding * 2);
  const logoMaxHeight = iconSize - (padding * 2);

  // Resize logo to fit within the padded area
  const resizedLogo = await sharp(inputPath)
    .resize(logoMaxWidth, logoMaxHeight, {
      fit: 'inside',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .toBuffer();

  // Get resized dimensions
  const resizedMeta = await sharp(resizedLogo).metadata();

  // Calculate position to center
  const left = Math.round((iconSize - resizedMeta.width) / 2);
  const top = Math.round((iconSize - resizedMeta.height) / 2);

  // Create final icon
  await sharp({
    create: {
      width: iconSize,
      height: iconSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{ input: resizedLogo, left, top }])
    .png()
    .toFile(outputPath);

  console.log('✓ Generated icon.png (1024x1024)');

  // Copy to adaptive-icon.png for Android
  await sharp(outputPath).toFile(adaptivePath);
  console.log('✓ Generated adaptive-icon.png');

  // Create splash screen (1284x2778 for iPhone)
  const splashWidth = 1284;
  const splashHeight = 2778;
  const splashLogoWidth = 600;

  const splashLogo = await sharp(inputPath)
    .resize(splashLogoWidth, null, {
      fit: 'inside'
    })
    .toBuffer();

  const splashLogoMeta = await sharp(splashLogo).metadata();
  const splashLeft = Math.round((splashWidth - splashLogoMeta.width) / 2);
  const splashTop = Math.round((splashHeight - splashLogoMeta.height) / 2);

  await sharp({
    create: {
      width: splashWidth,
      height: splashHeight,
      channels: 4,
      background: { r: 14, g: 165, b: 233, alpha: 1 } // Sky blue #0ea5e9
    }
  })
    .composite([{ input: splashLogo, left: splashLeft, top: splashTop }])
    .png()
    .toFile(splashPath);

  console.log('✓ Generated splash.png (1284x2778)');
  console.log('\nDone! Now rebuild the app with: eas build --platform ios --profile production');
}

generateIcon().catch(console.error);
