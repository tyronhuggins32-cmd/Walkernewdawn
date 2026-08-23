# Walker: New Dawn

Walker: New Dawn is an original top-down 2D zombie survival game being developed in Unity.

The long-term goal is a large procedural survival sandbox focused on:

- Looting
- Exploration
- Zombie avoidance
- Stealth
- Combat
- Hunger and thirst
- Infection
- Vehicles
- Base building
- Skills and traits
- Large procedural cities

## Current Biome

### New Dawn City

The first biome is inspired by the structure and density of New York City.

The procedural generator currently creates:

- Streets
- Intersections
- Sidewalks
- Crosswalks
- City blocks
- Buildings
- Service alleys
- Rooftop details
- Parking lots
- Abandoned vehicles
- Parks
- Trees
- Public plazas
- Different neighborhood densities

The generator uses a world seed.

This means the same seed creates the same city.

## Unity Version

Recommended:

Unity 2022.3 LTS or newer.

Use a 2D Core project.

## Installation

1. Clone or download this repository.
2. Open Unity Hub.
3. Create or open a Unity 2D project using the repository folder.
4. Make sure the scripts are located under:

Assets/Scripts/

5. Open any Unity scene.
6. Press Play.

GameBootstrap automatically creates:

- Player
- Camera
- Procedural city
- HUD

No prefabs are required for the prototype.

## Controls

W / A / S / D

or

Arrow Keys

Move the survivor.

Hold Left Shift to sprint.

Sprinting consumes stamina.

## Current World Generation

The world is divided into procedural chunks.

Chunks surrounding the player are generated automatically.

Chunks outside the render distance are unloaded.

When the player returns, the chunk is reconstructed using its deterministic seed.

This system is intended to eventually support an extremely large city without keeping the entire map loaded at once.

## Planned Features

### Zombies

Zombie states:

- Idle
- Wander
- Hear noise
- Investigate
- See survivor
- Chase
- Attack
- Search last known position
- Lose interest

### Buildings

Future building generation will include:

- Enterable interiors
- Procedural rooms
- Apartments
- Stores
- Warehouses
- Hospitals
- Police stations
- Fire stations
- Schools
- Office buildings
- Subway stations

### Survival

Planned systems:

- Health
- Hunger
- Thirst
- Fatigue
- Temperature
- Bleeding
- Wounds
- Infection
- Panic

### Inventory

Planned systems:

- Backpack capacity
- Item weight
- Containers
- Clothing
- Weapons
- Food
- Medicine
- Crafting

### Base Building

Future construction:

- Barricades
- Walls
- Doors
- Storage
- Furniture
- Rain collectors
- Generators
- Defensive structures

### Skills

Future skill categories:

- Strength
- Fitness
- Sprinting
- Sneaking
- Carpentry
- Mechanics
- First aid
- Cooking
- Shooting
- Melee

## Development Status

Early prototype.

The current focus is building the procedural city before layering the zombie survival simulation on top of it.
