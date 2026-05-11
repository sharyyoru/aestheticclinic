"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin } from "lucide-react";

type NominatimResult = {
  place_id: number;
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
    country_code?: string;
  };
  lat: string;
  lon: string;
};

type AddressComponents = {
  street: string;
  postalCode: string;
  town: string;
  country: string;
};

type AddressAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (components: AddressComponents) => void;
  placeholder?: string;
  className?: string;
  countryBias?: string;
};

export default function AddressAutocompleteInput({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Enter street address...",
  className = "",
  countryBias = "ch",
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchSuggestions(query: string) {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query)}&` +
          `format=json&` +
          `addressdetails=1&` +
          `countrycodes=${countryBias}&` +
          `limit=5`,
        {
          headers: {
            'User-Agent': 'AestheticClinic/1.0',
          },
        }
      );

      if (!response.ok) throw new Error("Nominatim request failed");

      const data: NominatimResult[] = await response.json();
      setSuggestions(data || []);
      setShowDropdown(true);
    } catch (error) {
      console.error("Nominatim geocoding error:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 500);
  }

  function extractAddressComponents(result: NominatimResult): AddressComponents {
    const addr = result.address;
    
    const street = addr.house_number && addr.road 
      ? `${addr.road} ${addr.house_number}`
      : addr.road || "";
    
    const postalCode = addr.postcode || "";
    
    const town = addr.city || addr.town || addr.village || addr.municipality || "";
    
    const country = addr.country_code?.toUpperCase() || "";

    return {
      street,
      postalCode,
      town,
      country,
    };
  }

  function handleSelectSuggestion(suggestion: NominatimResult) {
    onChange(suggestion.display_name);
    
    const components = extractAddressComponents(suggestion);
    onAddressSelect(components);
    
    setShowDropdown(false);
    setSuggestions([]);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600"></div>
          </div>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          <ul className="max-h-60 overflow-auto py-1">
            {suggestions.map((suggestion) => (
              <li key={suggestion.place_id}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span className="text-slate-900">
                    {suggestion.display_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
