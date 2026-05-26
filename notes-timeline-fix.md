# Timeline Fix Notes

## Problem
1. Category separators show numbers (2, 3, 4) instead of names ("Mini Convertibles", "Familiar", etc.)
2. Vehicle labels only show plate (1919MMM) without any model/name prefix

## Root Cause
- The `categoria` field in the `vehicles` table likely stores a numeric ID or code, not the category name
- The endpoint uses `v.categoria` directly as the category label
- Need to map category IDs to names, or fetch category names from a related table

## What Rently shows
- Category names: "Mini Convertibles", "Familiar", "Compact Premium", "Cabrio Premium", "SUV", "SUV Premium", "Luxury Van", "Aventura", "Luxury Elite"
- Vehicle labels: "CLASEB-10 3906MWM" (model prefix + plate)

## Fix needed
- Check what `v.categoria` actually contains (seems to be a number)
- Find where category names are stored (maybe fleet_vehicles or a categories table)
- Show `vehicle.model + " " + vehicle.plate` in the label column
