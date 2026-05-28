import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('office_locations')
      .select('id, name, address, city, country, latitude, longitude, radius, is_active')
      .eq('is_active', true)
      .order('name')

    if (error) throw error

    const locations = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      country: row.country,
      coordinates: {
        lat: Number(row.latitude),
        lng: Number(row.longitude),
      },
      radius: row.radius,
    }))

    return NextResponse.json({ locations })
  } catch (error) {
    console.error('Office locations error:', error)
    return NextResponse.json({ error: 'Failed to load office locations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, address, city, region, country, coordinates, radius, isActive } = body as {
      name: string
      address: string
      city: string
      region?: string
      country?: string
      coordinates: { lat: number; lng: number }
      radius?: number
      isActive?: boolean
    }

    const { data, error } = await supabaseAdmin
      .from('office_locations')
      .insert({
        name,
        address,
        city,
        region: region || null,
        country: country || region || city || 'Unknown',
        latitude: Number(coordinates?.lat || 0),
        longitude: Number(coordinates?.lng || 0),
        radius: Number(radius || 100),
        is_active: isActive ?? true,
      })
      .select('id, name, address, city, country, latitude, longitude, radius, is_active')
      .single()
    if (error) throw error

    return NextResponse.json({
      location: {
        id: data.id,
        name: data.name,
        address: data.address,
        city: data.city,
        region: region || '',
        country: data.country,
        coordinates: { lat: Number(data.latitude), lng: Number(data.longitude) },
        radius: data.radius,
        isActive: data.is_active,
      },
    })
  } catch (error) {
    console.error('Office locations POST error:', error)
    return NextResponse.json({ error: 'Failed to add office location' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, address, city, region, country, coordinates, radius, isActive } = body as {
      id: string
      name: string
      address: string
      city: string
      region?: string
      country?: string
      coordinates: { lat: number; lng: number }
      radius?: number
      isActive?: boolean
    }
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('office_locations')
      .update({
        name,
        address,
        city,
        region: region || null,
        country: country || region || city || 'Unknown',
        latitude: Number(coordinates?.lat || 0),
        longitude: Number(coordinates?.lng || 0),
        radius: Number(radius || 100),
        is_active: isActive ?? true,
      })
      .eq('id', id)
      .select('id, name, address, city, country, latitude, longitude, radius, is_active')
      .single()
    if (error) throw error

    return NextResponse.json({
      location: {
        id: data.id,
        name: data.name,
        address: data.address,
        city: data.city,
        region: region || '',
        country: data.country,
        coordinates: { lat: Number(data.latitude), lng: Number(data.longitude) },
        radius: data.radius,
        isActive: data.is_active,
      },
    })
  } catch (error) {
    console.error('Office locations PUT error:', error)
    return NextResponse.json({ error: 'Failed to update office location' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { error } = await supabaseAdmin.from('office_locations').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Office locations DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete office location' }, { status: 500 })
  }
}
