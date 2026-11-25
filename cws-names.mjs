// CrystalWorlds random alias maker (21 Nov 2026). Plain ES module, no packages.
//
//   pick()                    a describing word plus a noun: "Turbo Penguin"
//   pick('ninja')             about 45% of the time the noun matches the avatar: "Sneaky Ninja"
//   pick('ninja', { taken: true })   adds a two-digit number: "Sneaky Ninja 42"
//   createNamer(1234).pick()  the same names every run (for tests)
//
// Lists:
//   PLAIN_ADJECTIVES and GAME_ADJECTIVES make ADJECTIVES (describing words, one word each, hyphens allowed).
//   AVATAR_NOUNS: each of the 200 avatars has 1 to 6 nouns of its own (ids from avatars.mjs).
//   PLAIN_NOUNS and GAME_NOUNS make RANDOM_NOUNS (nouns that belong to no avatar).
//   AUSSIE_WORDS: the 31 Australian nouns, kept as they were (some now sit with their own avatar);
//   AUSSIE_NOUNS adds Tassie (the Tasmanian devil's noun) for the weighting.
// Game words are plain video game words (Respawning, Pixelated, Cartridge, Warp Zone, Final Boss).
// No game titles, series, characters or company names.
//
// Weighting (pick): the noun matches the avatar 45% of the time; otherwise it is a game noun, an
// Australian noun or any other noun. Australian nouns are set to about 15% of all nouns (about one
// name in seven), as the share was before the lists grew. A game describing word is chosen 35% of the time. The game noun chance is set so
// that about 25% of all nouns are game nouns, with or without an avatar, which puts a game word
// (either word) in about half of all names. test.mjs measures both shares over 20,000 names.
//
// Pairing rules (isPairAllowed): named pairs never given out; same-root pairs skipped; cooking words
// only with food; no rude piece across the join; a game describing word never goes with a two-word
// noun ("Turbo Final Boss"); a game describing word that reads like a noun ("Boss-Level", "Cheat-Code")
// never goes with a game noun; every pair must fit the alias rule with " 99" added.
//
// The alias rule copied from the site (cws-reach.mjs aliasProblem, and cwsv_text_ok on the vault):
// 1 to 32 characters, no leading or trailing space, no control or invisible characters.
// Every word here is plain letters, digits, hyphens and single spaces, so only the length can matter.

export const ALIAS_MAX = 32;

// ---- describing words (Australian spelling) ----
export const PLAIN_ADJECTIVES = [
  // electric
  'Neon', 'Electric', 'Digital', 'Analogue', 'Vintage', 'Classic',
  'Bionic', 'Robotic', 'Cyber', 'Laser', 'Hyper', 'Ultra', 'Nitro', 'Clockwork',
  'Rad', 'Tubular', 'Groovy', 'Funky', 'Jazzy', 'Snazzy', 'Zippy', 'Zany',
  // space and sky
  'Cosmic', 'Galactic', 'Starry', 'Lunar', 'Solar', 'Stellar', 'Orbiting',
  'Midnight', 'Twilight', 'Moonlit', 'Sunlit', 'Sunny', 'Breezy',
  'Snowy', 'Frosty', 'Icy', 'Toasty',
  // places
  'Holiday', 'Tropical', 'Arctic', 'Polar',
  // colours and metals
  'Golden', 'Silver', 'Crimson', 'Scarlet', 'Amber', 'Jade', 'Emerald', 'Sapphire', 'Cobalt', 'Indigo',
  'Violet', 'Teal', 'Copper',
  // brave and clever
  'Plucky', 'Brave', 'Bold', 'Fearless', 'Heroic', 'Adventurous', 'Daring',
  'Dashing', 'Clever', 'Crafty', 'Wise', 'Witty', 'Sly', 'Sneaky',
  'Stealthy', 'Secret', 'Hidden', 'Mysterious', 'Mystic', 'Curious', 'Silent', 'Quiet',
  // big words
  'Epic', 'Legendary', 'Mythic', 'Fabled', 'Awesome', 'Splendid', 'Superb', 'Majestic',
  'Brilliant', 'Wonderful', 'Royal', 'Noble',
  // shiny
  'Sparkly', 'Shiny', 'Glowing', 'Glittery', 'Twinkly', 'Dazzling', 'Radiant',
  // moods
  'Grumpy', 'Jolly', 'Merry', 'Happy', 'Cheery', 'Cheeky', 'Chipper', 'Perky',
  'Gleeful', 'Joyful', 'Chuffed', 'Smiley', 'Carefree', 'Eager', 'Keen',
  'Bashful', 'Shy', 'Sheepish', 'Proud', 'Humble', 'Mellow', 'Chilled',
  'Easygoing', 'Sleepy', 'Dreamy', 'Silly', 'Wacky', 'Dizzy', 'Noisy',
  'Boisterous', 'Rambunctious', 'Mischievous', 'Spooky', 'Gallant', 'Intrepid', 'Canny', 'Regal', 'Glorious',
  'Chirpy', 'Peppy', 'Hopeful', 'Snuggly', 'Spiffy', 'Giddy',
  // gentle and fancy
  'Gentle', 'Friendly', 'Cuddly', 'Cosy', 'Comfy', 'Fuzzy', 'Fluffy', 'Woolly',
  'Spiky', 'Stripy', 'Scruffy', 'Tiny', 'Dapper', 'Elegant', 'Graceful',
  'Nifty', 'Fancy', 'Lucky',
  // quick and moving
  'Nimble', 'Swift', 'Rapid', 'Snappy', 'Jumpy', 'Springy', 'Twirly', 'Swirly',
  'Soaring', 'Roaming', 'Wandering', 'Floating', 'Roving', 'Questing',
  'Humming', 'Buzzing', 'Whistling', 'Singing', 'Dancing', 'Juggling', 'Yodelling', 'Skating', 'Sailing',
  // tasty
  'Zesty', 'Zingy', 'Bubbly', 'Fizzy', 'Minty', 'Buttery', 'Crunchy', 'Crispy', 'Sugary',
];

// Video game describing words. The first seven were in the list before; the rest are new.
export const GAME_ADJECTIVES = [
  'Turbo', '8-Bit', 'Retro', 'Glitchy', 'Blocky', 'Bleepy', 'Lo-Fi',
  // how it looks
  'Pixelated', 'Pixel-Perfect', '16-Bit', '32-Bit', 'Hi-Res', 'Lo-Res', 'Low-Poly', 'Polygonal', 'Dithered',
  'Scrolling', 'Wireframe',
  'Blinking', 'Flashing', 'Beeping',
  // playing
  'Respawning', 'Warping', 'Teleporting', 'Shapeshifting', 'Speedrunning', 'Button-Mashing',
  'Double-Jumping', 'Wall-Jumping', 'Bouncing', 'Bouncy', 'Floaty', 'Spinning', 'Rolling', 'Hopping',
  'Platforming', 'Puzzling', 'Exploring', 'Collecting', 'Treasure-Hunting', 'Dungeon-Crawling',
  // powered
  'Turbocharged', 'Supercharged', 'Overclocked', 'Powered-Up', 'Charged-Up', 'Fully-Charged', 'Boosted', 'Buffed',
  'Overpowered', 'Maxed-Out', 'Invincible', 'Shielded', 'Unbeatable', 'Undefeated', 'Unstoppable',
  'Victorious', 'Triumphant', 'Expert', 'Casual', 'Ultimate', 'High-Scoring', 'Hi-Octane',
  // kinds of game
  'Bonus-Round', 'Boss-Level', 'Cheat-Code', 'Level-Up', 'Two-Player',
  'Endless', 'Infinite', 'Randomised', 'Unlockable', 'Unlocked', 'Collectable', 'Rare', 'Ultra-Rare',
  // the machine and the box
  'Handheld', 'Portable', 'Wireless', 'Plugged-In', 'Rumbling', 'Laggy', 'Buffering', 'Loading', 'Paused',
  'Rebooted', 'Homebrew', 'Modded', 'Patched', 'Debugged', 'Remastered', 'Remixed',
  'Deluxe', 'Boxed',
];

// Game describing words that read like a noun: they never go with a game noun ("Boss-Level Cartridge").
export const NOUNISH_ADJECTIVES = ['Bonus-Round', 'Boss-Level', 'Cheat-Code', 'Level-Up', 'Two-Player',
  'Treasure-Hunting', 'Dungeon-Crawling', 'Button-Mashing', 'Double-Jumping', 'Wall-Jumping', 'Hi-Octane'];

export const ADJECTIVES = [...PLAIN_ADJECTIVES, ...GAME_ADJECTIVES];

// ---- each avatar's own nouns (ids from avatars.mjs) ----
export const AVATAR_NOUNS = {
  // the first 26
  gentleman: ['Monsieur', 'Gent', 'Baguette', 'Beret'],
  echidna: ['Echidna', 'Puggle', 'Anteater'],
  knight: ['Knight', 'Squire', 'Jouster', 'Champion'],
  wizard: ['Wizard', 'Sorcerer', 'Mage', 'Spellcaster'],
  robot: ['Robot', 'Automaton', 'Robo'],
  astronaut: ['Astronaut', 'Cosmonaut', 'Spaceman', 'Spacewalker'],
  ninja: ['Ninja', 'Shadow', 'Shuriken'],
  cat: ['Cat', 'Kitten', 'Tabby', 'Moggy'],
  dog: ['Dog', 'Puppy', 'Pup', 'Pooch', 'Doggo', 'Hound'],
  ghost: ['Ghost', 'Phantom', 'Spectre', 'Ghostie'],
  slime: ['Slime', 'Goo', 'Gloop', 'Jelly'],
  dragon: ['Dragon', 'Wyvern', 'Wyrm'],
  alien: ['Alien', 'Martian', 'Visitor'],
  pirate: ['Pirate', 'Buccaneer', 'Swashbuckler', 'Seadog'],
  chef: ['Chef', 'Cook', 'Baker'],
  racer: ['Racer', 'Speedster', 'Dragster', 'Roadster'],
  rocket: ['Rocket', 'Rocketship', 'Spaceship'],
  cactus: ['Cactus', 'Saguaro', 'Succulent'],
  skeleton: ['Skeleton', 'Skelly', 'Skull'],
  frog: ['Frog', 'Tadpole', 'Froglet', 'Treefrog'],
  owl: ['Owl', 'Owlet', 'Nightbird'],
  bear: ['Bear', 'Cub', 'Grizzly', 'Teddy'],
  diver: ['Diver', 'Aquanaut', 'Snorkeller'],
  cowboy: ['Cowboy', 'Drover', 'Jackaroo', 'Rancher'],
  king: ['King', 'Monarch', 'Majesty'],
  penguin: ['Penguin', 'Rockhopper', 'Waddler'],
  // animals
  fox: ['Fox', 'Reynard'],
  rabbit: ['Rabbit', 'Bunny', 'Hopper'],
  mouse: ['Mouse', 'Squeaker'],
  pig: ['Pig', 'Oinker'],
  cow: ['Calf', 'Moo-Cow', 'Jersey'],
  horse: ['Horse', 'Pony', 'Stallion', 'Steed'],
  sheep: ['Sheep', 'Lamb', 'Merino'],
  goat: ['Goat', 'Billygoat'],
  giraffe: ['Giraffe'],
  elephant: ['Elephant', 'Jumbo'],
  lion: ['Lion', 'Lioness'],
  tiger: ['Tiger', 'Tigress'],
  panda: ['Panda'],
  monkey: ['Monkey', 'Chimp', 'Marmoset'],
  shark: ['Shark', 'Hammerhead'],
  octopus: ['Octopus', 'Squid'],
  turtle: ['Turtle', 'Tortoise', 'Terrapin'],
  snail: ['Snail'],
  crab: ['Crab', 'Pincher'],
  squirrel: ['Squirrel', 'Chipmunk'],
  deer: ['Deer', 'Fawn', 'Stag', 'Reindeer'],
  macaw: ['Macaw', 'Parrot'],
  flamingo: ['Flamingo'],
  whale: ['Whale', 'Narwhal'],
  hippo: ['Hippo', 'Hippopotamus'],
  // Australian animals (Cockatoo, Cassowary, Galah and Devil are left out: see test.mjs)
  kangaroo: ['Kangaroo', 'Joey', 'Wallaby'],
  koala: ['Koala'],
  wombat: ['Wombat'],
  platypus: ['Platypus', 'Duckbill'],
  emu: ['Emu'],
  kookaburra: ['Kookaburra'],
  cockatoo: ['Screecher', 'Squawker'],
  quokka: ['Quokka'],
  'tassie-devil': ['Tassie', 'Chomper'],
  dingo: ['Dingo'],
  possum: ['Possum', 'Ringtail'],
  'sugar-glider': ['Glider'],
  'frill-neck': ['Frillneck'],
  crocodile: ['Crocodile', 'Croc'],
  magpie: ['Magpie', 'Swooper'],
  cassowary: ['Stomper'],
  galah: ['Rosebird'],
  bilby: ['Bilby'],
  numbat: ['Numbat'],
  'blue-tongue': ['Bluetongue', 'Skink'],
  lyrebird: ['Lyrebird', 'Mimic'],
  pelican: ['Pelican'],
  goanna: ['Goanna', 'Lizard'],
  'flying-fox': ['Fruitbat', 'Bat'],
  lorikeet: ['Lorikeet', 'Rainbow'],
  // fantasy (Fairy is left out: an old slur)
  elf: ['Elf', 'Elfkin'],
  dwarf: ['Dwarf', 'Delver'],
  orc: ['Orc', 'Brute'],
  troll: ['Troll', 'Ogre'],
  fairy: ['Pixie', 'Fae'],
  witch: ['Witch', 'Enchantress', 'Sorceress'],
  paladin: ['Paladin', 'Guardian'],
  barbarian: ['Barbarian', 'Berserker'],
  bard: ['Bard', 'Minstrel', 'Troubadour'],
  druid: ['Druid', 'Grovekeeper'],
  vampire: ['Vampire', 'Fang'],
  werewolf: ['Werewolf', 'Wolf', 'Howler'],
  mummy: ['Mummy', 'Pharaoh'],
  zombie: ['Zombie', 'Shambler'],
  genie: ['Genie'],
  mermaid: ['Mermaid', 'Siren'],
  centaur: ['Centaur'],
  minotaur: ['Minotaur'],
  cyclops: ['Cyclops', 'Giant'],
  gnome: ['Gnome'],
  goblin: ['Goblin', 'Gremlin'],
  unicorn: ['Unicorn'],
  phoenix: ['Phoenix'],
  golem: ['Golem'],
  jester: ['Jester', 'Trickster'],
  // jobs
  firefighter: ['Firefighter', 'Fireman'],
  nurse: ['Nurse', 'Carer'],
  doctor: ['Doctor', 'Doc', 'Medic'],
  farmer: ['Farmer', 'Grazier'],
  builder: ['Builder', 'Bricklayer', 'Carpenter'],
  artist: ['Artist', 'Painter', 'Doodler'],
  postie: ['Postie', 'Courier'],
  scientist: ['Scientist', 'Boffin', 'Professor', 'Inventor'],
  teacher: ['Teacher', 'Tutor'],
  mechanic: ['Mechanic', 'Fixer', 'Tinkerer'],
  gardener: ['Gardener', 'Planter'],
  pilot: ['Pilot', 'Aviator', 'Flyer'],
  sailor: ['Sailor', 'Mariner', 'Deckhand'],
  lifeguard: ['Lifeguard', 'Rescuer'],
  librarian: ['Librarian', 'Bookworm', 'Archivist'],
  photographer: ['Photographer', 'Shutterbug'],
  guitarist: ['Guitarist', 'Rocker'],
  drummer: ['Drummer', 'Percussionist'],
  conductor: ['Conductor', 'Bandleader'],
  magician: ['Magician', 'Conjurer', 'Illusionist'],
  juggler: ['Juggler', 'Busker'],
  explorer: ['Explorer', 'Adventurer'],
  miner: ['Miner', 'Digger'],
  lumberjack: ['Lumberjack', 'Woodcutter', 'Logger'],
  beekeeper: ['Beekeeper', 'Apiarist', 'Honeybee'],
  // sports
  soccer: ['Striker', 'Goalie', 'Midfielder'],
  footy: ['Footballer', 'Ruckman'],
  'cricket-batter': ['Batter', 'Batsman', 'Opener'],
  'cricket-bowler': ['Bowler', 'Spinner', 'Paceman'],
  tennis: ['Ace', 'Volleyer', 'Racquet'],
  basketball: ['Hooper', 'Dunker'],
  surfer: ['Surfer', 'Boardrider', 'Grommet'],
  skateboarder: ['Skateboarder', 'Skater'],
  swimmer: ['Swimmer', 'Freestyler'],
  cyclist: ['Cyclist', 'Pedaller'],
  sprinter: ['Sprinter', 'Runner'],
  boxer: ['Boxer', 'Pugilist'],
  karate: ['Karateka', 'Sensei'],
  golfer: ['Golfer', 'Putter', 'Caddie'],
  skier: ['Skier'],
  snowboarder: ['Snowboarder', 'Boarder'],
  'ice-skater': ['Ice Skater', 'Twirler'],
  hockey: ['Puckster', 'Stickhandler'],
  baseball: ['Slugger', 'Ballplayer'],
  archer: ['Archer', 'Bowman'],
  fencer: ['Fencer', 'Duellist', 'Swordsman'],
  weightlifter: ['Weightlifter', 'Strongman', 'Lifter'],
  climber: ['Climber', 'Mountaineer', 'Alpinist'],
  gymnast: ['Gymnast', 'Tumbler'],
  'lawn-bowler': ['Lawn Bowler'],
  // space and robots (Android and Droid are left out: brands)
  'space-captain': ['Captain', 'Commander'],
  'tentacle-alien': ['Squidling', 'Wriggler'],
  'one-eyed-alien': ['Eyeball', 'Blinker'],
  'crystal-alien': ['Crystal', 'Shard', 'Prism'],
  'ball-robot': ['Rollbot', 'Roller'],
  'track-robot': ['Treadbot', 'Crawler'],
  android: ['Synth', 'Humanoid'],
  drone: ['Drone', 'Quadcopter'],
  mech: ['Mech', 'Mecha', 'Exosuit'],
  'robot-dog': ['Robodog', 'Robopup'],
  'robot-butler': ['Butler', 'Valet'],
  'tin-robot': ['Tinbot', 'Clunker'],
  cyborg: ['Cyborg', 'Cybernaut'],
  'space-trooper': ['Trooper', 'Sentinel'],
  saucer: ['Saucer', 'UFO'],
  'hover-bike': ['Hoverbike', 'Skimmer'],
  jetpack: ['Jetpack'],
  'moon-rover': ['Rover', 'Buggy'],
  satellite: ['Satellite', 'Orbiter', 'Beacon'],
  'time-traveller': ['Chrononaut', 'Time Traveller'],
  'space-miner': ['Rockhound', 'Prospector'],
  'radar-robot': ['Radarbot', 'Scanner'],
  'alien-pet': ['Critter', 'Bloblet'],
  'android-medic': ['Medibot', 'Healer'],
  'robot-gardener': ['Gardenbot', 'Mowbot'],
  // things and monsters
  tractor: ['Tractor'],
  bus: ['Bus', 'Coach'],
  'steam-train': ['Locomotive', 'Steam Train'],
  'fire-engine': ['Fire Engine', 'Firetruck'],
  submarine: ['Submarine', 'Periscope'],
  helicopter: ['Helicopter', 'Copter', 'Whirlybird'],
  sailboat: ['Sailboat', 'Yacht', 'Dinghy'],
  balloon: ['Balloon', 'Airship'],
  motorbike: ['Motorbike', 'Motorcycle'],
  biplane: ['Biplane', 'Barnstormer'],
  teapot: ['Teapot', 'Teacup'],
  'alarm-clock': ['Alarm Clock', 'Clock'],
  umbrella: ['Umbrella', 'Brolly', 'Parasol'],
  book: ['Book', 'Storybook', 'Novel'],
  pencil: ['Pencil', 'Scribbler'],
  television: ['Television', 'Telly'],
  'light-bulb': ['Lightbulb', 'Bulb'],
  kettle: ['Kettle'],
  yeti: ['Yeti', 'Sasquatch', 'Bigfoot'],
  'swamp-monster': ['Bog Beast', 'Mudlark'],
  'furry-monster': ['Fuzzball', 'Bugbear'],
  gargoyle: ['Gargoyle'],
  'rock-monster': ['Boulder'],
  imp: ['Imp', 'Scamp', 'Rascal'],
};

// ---- random nouns: these belong to no avatar ----
export const PLAIN_NOUNS = [
  // Australian (the rest of the 31 now sit with their own avatar)
  'Bandicoot', 'Kelpie', 'Bowerbird', 'Yabby', 'Barramundi', 'Larrikin', 'Lamington', 'Pavlova', 'Jaffle',
  'Wattle', 'Waratah', 'Banksia', 'Boomerang', 'Gumnut',
  // creatures
  'Badger', 'Otter', 'Llama', 'Alpaca', 'Walrus', 'Seahorse', 'Lemur', 'Sloth', 'Firefly', 'Dragonfly',
  'Ladybird', 'Butterfly', 'Gecko', 'Axolotl', 'Meerkat', 'Capybara', 'Zebra',
  'Toucan', 'Puffin', 'Falcon', 'Mammoth', 'Dinosaur',
  // things
  'Comet', 'Quasar', 'Asteroid', 'Moonbeam', 'Thunder', 'Volcano', 'Waffle', 'Pancake', 'Pretzel',
  'Noodle', 'Dumpling', 'Pickle', 'Biscuit', 'Cupcake', 'Doughnut', 'Jellybean', 'Gadget',
  'Lantern', 'Ukulele', 'Kazoo',
];

// Video game nouns. The first 26 were in the list before (Highscore and Powerup now spelled Hi-Score
// and Power-Up); the rest are new. Two-word nouns are kept few.
export const GAME_NOUNS = [
  'Cartridge', 'Cassette', 'Gamepad', 'Joypad', 'Pinball', 'Paddle', 'Arcade', 'Hi-Score',
  'Bonus', 'Power-Up', 'Checkpoint', 'Boss', 'Token', 'Coin', 'Glitch', 'Chiptune', 'Blip', 'Byte',
  'Button', 'Speedrunner', 'Gamer', 'Sidekick', 'Hero', 'Treasure', 'Trophy', 'Potion',
  // the machine
  'Pixel', 'Bit', 'Kilobyte', 'Nibble', 'Coin-Op', 'Cabinet', 'Console', 'Controller', 'D-Pad', 'Thumbstick',
  'Trackball', 'Keypad', 'Headset', 'Rumble', 'Microchip', 'Chipset', 'Circuit', 'Mainframe',
  'Polygon', 'Voxel', 'Bitmap', 'Tile', 'Palette', 'Scanline', 'Cursor', 'Lag', 'Bug', 'Patch', 'Mod',
  'Beep', 'Bloop', 'Jingle', 'Soundtrack',
  // playing
  'Level', 'Stage', 'World', 'Zone', 'Dungeon', 'Overworld', 'Castle', 'Tower', 'Labyrinth', 'Maze', 'Lair',
  'Hideout', 'Fortress', 'Arena', 'Respawn', 'Continue', '1-Up', 'Speedrun', 'Minigame', 'Puzzle',
  'Platformer', 'Sandbox', 'Showdown', 'Duel', 'Quest', 'Leaderboard', 'Scoreboard', 'Streak', 'Medal',
  'Badge', 'Teleporter', 'Wormhole',
  // things to find
  'Loot', 'Pickup', 'Gem', 'Jewel', 'Diamond', 'Star', 'Heart', 'Key', 'Map', 'Compass', 'Torch', 'Orb',
  'Shield', 'Helmet', 'Mana', 'Elixir', 'Amulet', 'Talisman', 'Rune', 'Scroll', 'Spellbook', 'Wand',
  'Relic', 'Artefact',
  // people in games
  'Henchman', 'Villain', 'Rival', 'Challenger', 'Contender', 'Shopkeeper', 'Playtester', 'Modder',
  'Coder', 'Rookie', 'Veteran', 'Streamer', 'Completionist', 'Mini-Boss',
  // two words
  'Warp Zone', 'Extra Life', 'Save Point', 'Start Button', 'Debug Mode', 'Easter Egg', 'Final Boss',
  'Side Quest', 'Player One', 'Memory Card',
];

export const RANDOM_NOUNS = [...PLAIN_NOUNS, ...GAME_NOUNS];
export const NOUNS = [...Object.values(AVATAR_NOUNS).flat(), ...RANDOM_NOUNS];

// The 31 Australian nouns, kept as they were (test.mjs checks they are all still there).
export const AUSSIE_WORDS = ['Wombat', 'Kookaburra', 'Dingo', 'Quokka', 'Koala', 'Kangaroo', 'Wallaby', 'Platypus',
  'Possum', 'Bilby', 'Numbat', 'Bandicoot', 'Emu', 'Lyrebird', 'Lorikeet', 'Magpie', 'Kelpie', 'Joey', 'Goanna',
  'Bowerbird', 'Yabby', 'Barramundi', 'Larrikin', 'Lamington', 'Pavlova', 'Jaffle', 'Wattle', 'Waratah', 'Banksia',
  'Boomerang', 'Gumnut'];

const GAME_ADJ_SET = new Set(GAME_ADJECTIVES), GAME_NOUN_SET = new Set(GAME_NOUNS), NOUNISH_SET = new Set(NOUNISH_ADJECTIVES);
export const isGameWord = (w) => GAME_ADJ_SET.has(w) || GAME_NOUN_SET.has(w);

// ---- pairs never given out ----
// Known titles, brands, characters or real people the two words would name, or a pairing that reads badly.
export const BLOCKED_PAIRS = new Set([
  'Grumpy Cat',        // a famous internet cat and its trademark
  'Grumpy Bear',       // a toy and cartoon character
  'Golden Bear',       // a real golfer's nickname
  'Golden Knight',     // a sports team
  'Friendly Ghost',    // a cartoon character's tagline
  'Silent Knight',     // reads as a Christmas carol
  'Midnight Cowboy',   // a film
  'Jolly Rancher',     // a sweets brand
  'Merry Monarch',     // a real king's nickname
  'Happy Chef',        // a restaurant chain
  'Happy Hippo',       // a chocolate brand
  'Turbo Chef',        // an oven brand
  'Turbo Dog',         // a beer brand
  'Turbo Snail',       // a film character
  'Wacky Racer',       // a cartoon series
  'Secret Squirrel',   // a cartoon character
  'Electric Wizard',   // a band
  'Arctic Cat',        // a snowmobile brand
  'Royal Jelly',       // a health product
  'Jungle King',       // an arcade game
  'Clockwork Knight',  // a console game
  'Mythic Quest',      // a television series
  'Mystic Quest',      // a console game
  'Awesome Possum',    // a console game
  'Tropical Thunder',  // a film
  'Hidden Dragon',     // a film title
  'Dancing Bear',      // a cruel old practice
  'Grumpy Monsieur',   // a national stereotype
  'Mega Byte',         // a unit, and a brand spelling
  'Giga Byte',         // a computer parts brand
  'Tiny Teddy',        // an Australian biscuit brand
  'Proud Rainbow',     // reads as a cause, not a name
  'Silver Surfer',     // a comic character
  'Lucky Rabbit',      // a cartoon character
  'Arctic Monkey',     // a band
  'Funky Monkey',      // a song and a brand
  'Frosty Tiger',      // a cereal mascot
  'Lucky Star',        // a song and a cartoon
  'Brave Heart',       // a film
  'Wonderful World',   // a song
  'Twilight Zone',     // a television series
  'Secret Level',      // a television series
  'Golden Compass',    // a book and film
  'Friendly Giant',    // a television series
  'Jolly Giant',       // close to a vegetable brand mascot
  'Retro Gamer',       // a magazine
  'Tiny Dwarf',        // mocks people of short stature
  'Icy Ice Skater',    // reads twice
  'Skating Ice Skater',
  'Roving Rover',
  'Sailing Sailboat',
  'Snowy Yeti',
  'Neon Genesis',      // guard: an anime title (Genesis not in the lists)
  'Electric Imp',      // a technology company
  'Wonderful Wizard',  // a book title
  'Crimson Ghost',     // a film serial and a band mascot
  'Lunar Knight',      // a console game
  'Royal Rumble',      // a wrestling event
  'Hyper Zone',        // a console game
  'Royal Quest',       // an online game
  'Cyber Shadow',      // a console game
  'Scarlet Witch',     // a comic character
  'Silver Fox',        // slang for an older man
  'Golden Book',       // a book brand
  'Grumpy Dwarf', 'Happy Dwarf', 'Sleepy Dwarf', 'Bashful Dwarf',   // a fairy-tale film's characters
]);

// Cooking words only go with food: "Crispy Baguette" yes, "Crunchy Puppy" never.
export const COOKED = ['Crispy', 'Crunchy', 'Buttery'];
export const FOODS = ['Baguette', 'Lamington', 'Pavlova', 'Jaffle', 'Waffle', 'Pancake', 'Pretzel', 'Noodle', 'Dumpling',
  'Pickle', 'Biscuit', 'Cupcake', 'Doughnut', 'Jellybean', 'Jelly'];

// Rude, unkind or off-limits pieces: body, toilet, sex, slurs, swearing, violence, drugs and drink,
// religion, politics, mocking words. test.mjs checks every word for them; here they hold back any pair
// that makes one when the two words are run together without the space ("Tubular Seahorse").
export const RUDE_PIECES = [
  'fuck', 'shit', 'cunt', 'cock', 'dick', 'twat', 'wank', 'piss', 'slut', 'whore', 'hoe', 'tit', 'boob', 'nipple',
  'arse', 'ass', 'butt', 'bum', 'anal', 'anus', 'poo', 'pee', 'wee', 'fart', 'turd', 'crap', 'spew', 'vomit', 'puke',
  'sex', 'porn', 'nude', 'naked', 'horny', 'boner', 'bone', 'balls', 'nut', 'sack', 'spunk', 'cum', 'semen', 'sperm',
  'shag', 'hump', 'root', 'knob', 'bonk', 'booty', 'thong', 'bra', 'pube', 'scrot', 'penis', 'vagina', 'breast',
  'fag', 'nig', 'coon', 'spic', 'chink', 'gook', 'kike', 'wop', 'jap', 'dyke', 'homo', 'gay', 'tranny', 'abo', 'boong',
  'retard', 'spaz', 'cripple', 'lame', 'psycho', 'crazy', 'mental', 'loony', 'nutter', 'idiot', 'moron', 'stupid', 'dumb',
  'ugly', 'fat', 'loser', 'nerd', 'geek', 'dork', 'drongo', 'galah', 'bogan',
  'bitch', 'bastard', 'bugger', 'bloody', 'damn', 'hell', 'bollock', 'tosser', 'pom',
  'kill', 'die', 'dead', 'death', 'murder', 'blood', 'stab', 'shoot', 'gun', 'bomb', 'terror', 'war', 'rape', 'nazi',
  'hitler', 'kkk', 'slave', 'drug', 'weed', 'meth', 'coke', 'crack', 'beer', 'wine', 'booze', 'drunk', 'vodka',
  'god', 'jesus', 'christ', 'satan', 'devil', 'demon', 'allah', 'pope', 'church', 'bible', 'holy', 'sin',
  'trump', 'biden', 'labor', 'liberal', 'tory', 'commie', 'isis', 'jihad',
  'heroin', 'noob',
];
const clean = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
export function joinPieces(adj, noun) {
  const a = clean(adj), j = a + clean(noun);
  const hits = [];
  for (const p of RUDE_PIECES) {
    for (let i = j.indexOf(p); i !== -1; i = j.indexOf(p, i + 1)) if (i < a.length && i + p.length > a.length) hits.push(p);
  }
  return hits;
}

// Same-root pairs ("Cosmic Cosmonaut", "Pixelated Pixel", "Spawning Respawn", "Boss-Level Final Boss") read clumsily:
// skipped when the first four letters match, or when either word holds the start of the other.
function sameRoot(adj, noun) {
  const a = clean(adj), n = clean(noun);
  if (a.slice(0, 4) === n.slice(0, 4)) return true;
  const pa = a.slice(0, 4), pn = n.slice(0, 4);
  return (pa.length >= 3 && n.includes(pa)) || (pn.length >= 3 && a.includes(pn));
}
export function isPairAllowed(adj, noun) {
  if (BLOCKED_PAIRS.has(adj + ' ' + noun)) return false;
  if (sameRoot(adj, noun)) return false;
  if (COOKED.includes(adj) && !FOODS.includes(noun)) return false;
  if (GAME_ADJ_SET.has(adj) && noun.includes(' ')) return false;          // "Turbo Final Boss"
  if (NOUNISH_SET.has(adj) && GAME_NOUN_SET.has(noun)) return false;      // "Boss-Level Cartridge"
  if ([...(adj + ' ' + noun + ' 99')].length > ALIAS_MAX) return false;   // room for a "taken" number
  if (joinPieces(adj, noun).length) return false;
  return true;
}

// The site's own alias check, copied from cws-reach.mjs aliasProblem (21 Nov 2026).
export function aliasProblem(a) {
  if (!a) return 'Choose an alias others will see.';
  if ([...a].length > ALIAS_MAX) return 'An alias is at most 32 characters.';
  if (a !== a.trim()) return 'An alias cannot start or end with a space.';
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cs}]/u.test(a)) return 'That alias has a character that cannot be shown.';
  return '';
}

// Small seeded random (mulberry32): the same seed gives the same names.
export function seededRandom(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const len = (s) => [...s].length;
const one = (list, rnd) => list[Math.floor(rnd() * list.length)];

// Fit the name into max characters: both words, else the noun alone, else the describing word alone.
function fit(adj, noun, max, suffix) {
  for (const name of [adj + ' ' + noun, noun, adj]) {
    if (len(name) + len(suffix) <= max) return name + suffix;
  }
  return (noun + suffix).slice(0, max);   // cannot happen with these lists; kept so the result is never too long
}

// The weighting (see the top of the file).
export const OWN_SHARE = 0.45;        // the noun is one of the avatar's own
export const GAME_ADJ_SHARE = 0.35;   // the describing word is a game word
export const GAME_NOUN_SHARE = 0.25;  // of all nouns, this share are game nouns
export const AUSSIE_SHARE = 0.15;     // of all nouns, this share are Australian nouns
export const AUSSIE_NOUNS = [...AUSSIE_WORDS, 'Tassie'];
const AUSSIE_SET = new Set(AUSSIE_NOUNS);
const PLAIN_POOL = NOUNS.filter((n) => !GAME_NOUN_SET.has(n) && !AUSSIE_SET.has(n));

// pick(avatarId?, { taken, random, max }):
//   avatarId  an id from avatars.mjs; about 45% of the time the noun is one of that avatar's own
//   taken     true when the caller knows the name is already in use: adds " 10" to " 99"
//   random    a function giving 0 <= x < 1 (default Math.random); use seededRandom(n) for tests
//   max       the alias limit (default 32)
export function pick(avatarId, opts = {}) {
  const rnd = opts.random || Math.random;
  const max = opts.max || ALIAS_MAX;
  const own = (avatarId && AVATAR_NOUNS[avatarId]) || null;
  const notOwn = (list) => (own ? list.filter((n) => !own.includes(n)) : list);
  const others = notOwn(PLAIN_POOL), aussie = notOwn(AUSSIE_NOUNS);
  const rest = own ? 1 - OWN_SHARE : 1;
  const gameNoun = GAME_NOUN_SHARE / rest, aussieNoun = AUSSIE_SHARE / rest;
  let adj, noun;
  for (let tries = 0; tries < 50; tries++) {
    if (own && rnd() < OWN_SHARE) noun = one(own, rnd);
    else {
      const r = rnd();
      noun = r < gameNoun ? one(GAME_NOUNS, rnd) : r < gameNoun + aussieNoun ? one(aussie, rnd) : one(others, rnd);
    }
    adj = rnd() < GAME_ADJ_SHARE ? one(GAME_ADJECTIVES, rnd) : one(PLAIN_ADJECTIVES, rnd);
    if (isPairAllowed(adj, noun)) break;
  }
  const suffix = opts.taken ? ' ' + (10 + Math.floor(rnd() * 90)) : '';
  return fit(adj, noun, max, suffix);
}

// A namer with its own seeded random: createNamer(7).pick('owl') gives the same names every run.
export function createNamer(seed) {
  const random = seededRandom(seed);
  return { pick: (avatarId, opts = {}) => pick(avatarId, { ...opts, random }) };
}
