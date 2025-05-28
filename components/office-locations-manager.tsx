'use client'

import React from 'react'
import { useState } from 'react'
import { Plus, Trash2, MapPin } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { countries } from '@/lib/countries'

interface OfficeLocation {
  id: string
  name: string
  address: string
  city: string
  state: string
  country: string
  postalCode: string
  isActive: boolean
}

interface OfficeLocationsManagerProps {
  locations: OfficeLocation[]
  onLocationsChange: (locations: OfficeLocation[]) => void
}

export function OfficeLocationsManager({ locations = [], onLocationsChange }: OfficeLocationsManagerProps) {
  const [newLocation, setNewLocation] = useState<Partial<OfficeLocation>>({
    name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    isActive: true,
  })

  const handleAddLocation = () => {
    if (!newLocation.name || !newLocation.address || !newLocation.country) {
      return
    }

    const location: OfficeLocation = {
      id: crypto.randomUUID(),
      name: newLocation.name,
      address: newLocation.address,
      city: newLocation.city || '',
      state: newLocation.state || '',
      country: newLocation.country,
      postalCode: newLocation.postalCode || '',
      isActive: true,
    }

    onLocationsChange([...locations, location])
    setNewLocation({
      name: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      isActive: true,
    })
  }

  const handleDeleteLocation = (id: string) => {
    onLocationsChange(locations.filter(location => location.id !== id))
  }

  const handleToggleActive = (id: string) => {
    onLocationsChange(
      locations.map(location =>
        location.id === id
          ? { ...location, isActive: !location.isActive }
          : location
      )
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Office Locations</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddLocation}
          disabled={!newLocation.name || !newLocation.address || !newLocation.country}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Input
          placeholder="Location Name"
          value={newLocation.name}
          onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
        />
        <Input
          placeholder="Address"
          value={newLocation.address}
          onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
        />
        <Input
          placeholder="City"
          value={newLocation.city}
          onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
        />
        <Input
          placeholder="State/Province"
          value={newLocation.state}
          onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })}
        />
        <Select
          value={newLocation.country}
          onValueChange={(value) => setNewLocation({ ...newLocation, country: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Country" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Postal Code"
          value={newLocation.postalCode}
          onChange={(e) => setNewLocation({ ...newLocation, postalCode: e.target.value })}
        />
      </div>

      <div className="space-y-4">
        {(locations || []).map((location) => (
          <div
            key={location.id}
            className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
          >
            <div className="flex items-center space-x-4">
              <MapPin className="h-5 w-5 text-gray-400" />
              <div>
                <h4 className="font-medium">{location.name}</h4>
                <p className="text-sm text-gray-500">
                  {location.address}
                  {location.city && `, ${location.city}`}
                  {location.state && `, ${location.state}`}
                  {location.postalCode && ` ${location.postalCode}`}
                  {`, ${countries.find(c => c.code === location.country)?.name || location.country}`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggleActive(location.id)}
                className={location.isActive ? 'text-green-600' : 'text-gray-400'}
              >
                {location.isActive ? 'Active' : 'Inactive'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteLocation(location.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 