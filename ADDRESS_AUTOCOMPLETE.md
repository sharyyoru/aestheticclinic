# Address Autocomplete Setup

This project uses **Nominatim (OpenStreetMap)** for address autocomplete functionality in the patient address form.

## ✅ No Setup Required!

Nominatim is completely free and requires **no API key** or registration. It works out of the box.

## How It Works

- **Component**: `src/components/AddressAutocompleteInput.tsx`
- **Used in**: Patient address modal (`src/app/patients/[id]/PatientCockpitDetails.tsx`)
- **API**: Nominatim (OpenStreetMap Geocoding API)
- **Features**: 
  - Real-time address suggestions as you type (debounced 500ms)
  - Auto-fills zip code, town, and country when you select an address
  - Biased to Switzerland (`countryBias="ch"`) by default
  - **100% free** with no signup

## Usage

1. Open patient profile
2. Click edit icon on "Patient Address" section
3. Start typing a street address (min 3 characters)
4. Select from suggestions
5. Zip code, town, and country auto-fill

## Nominatim Usage Policy

Nominatim has a fair use policy:
- **Rate limit**: 1 request/second (handled by 500ms debounce)
- **User-Agent required**: Already configured (`AestheticClinic/1.0`)
- **Free for everyone**: No limits on total requests

## Troubleshooting

### No suggestions appearing

Check:
1. You're typing at least 3 characters
2. Wait 500ms after typing (debounce delay)
3. Check browser console for network errors
4. Ensure internet connection is active

### Rate limiting errors

If you see `HTTP 429` errors:
- You're making too many requests too fast
- The 500ms debounce should prevent this
- Consider increasing debounce if needed

## Technical Details

**API Endpoint**: `https://nominatim.openstreetmap.org/search`

**Parameters**:
- `q`: Search query (street address)
- `format=json`: JSON response
- `addressdetails=1`: Include detailed address components
- `countrycodes=ch`: Bias to Switzerland
- `limit=5`: Max 5 suggestions

**Response parsing**:
- `address.road` + `address.house_number` → Street
- `address.postcode` → Zip Code
- `address.city` / `address.town` → Town
- `address.country_code` → Country (ISO2)

## Data Source

Address data comes from **OpenStreetMap** - a collaborative, open-source mapping project maintained by volunteers worldwide.
