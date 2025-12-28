// js/constants.js - Shared constants and mappings

export const TEAM_ABBREV_MAP = {
    'Anaheim Ducks': 'ANA',
    'Arizona Coyotes': 'ARI',
    'Boston Bruins': 'BOS',
    'Buffalo Sabres': 'BUF',
    'Calgary Flames': 'CGY',
    'Carolina Hurricanes': 'CAR',
    'Chicago Blackhawks': 'CHI',
    'Colorado Avalanche': 'COL',
    'Columbus Blue Jackets': 'CBJ',
    'Dallas Stars': 'DAL',
    'Detroit Red Wings': 'DET',
    'Edmonton Oilers': 'EDM',
    'Florida Panthers': 'FLA',
    'Los Angeles Kings': 'LAK',
    'Minnesota Wild': 'MIN',
    'Montreal Canadiens': 'MTL',
    'Montréal Canadiens': 'MTL',
    'Nashville Predators': 'NSH',
    'New Jersey Devils': 'NJD',
    'New York Islanders': 'NYI',
    'New York Rangers': 'NYR',
    'Ottawa Senators': 'OTT',
    'Philadelphia Flyers': 'PHI',
    'Pittsburgh Penguins': 'PIT',
    'San Jose Sharks': 'SJS',
    'Seattle Kraken': 'SEA',
    'St. Louis Blues': 'STL',
    'St Louis Blues': 'STL',
    'Tampa Bay Lightning': 'TBL',
    'Toronto Maple Leafs': 'TOR',
    'Utah Hockey Club': 'UTA',
    'Utah Mammoth': 'UTA',
    'Vancouver Canucks': 'VAN',
    'Vegas Golden Knights': 'VGK',
    'Washington Capitals': 'WSH',
    'Winnipeg Jets': 'WPG'
};

export const ABBREV_TO_FULL = {
    'TOR': 'Toronto Maple Leafs',
    'BOS': 'Boston Bruins',
    'TBL': 'Tampa Bay Lightning',
    'FLA': 'Florida Panthers',
    'MTL': 'Montreal Canadiens',
    'OTT': 'Ottawa Senators',
    'BUF': 'Buffalo Sabres',
    'DET': 'Detroit Red Wings',
    'NYR': 'New York Rangers',
    'NYI': 'New York Islanders',
    'NJD': 'New Jersey Devils',
    'PIT': 'Pittsburgh Penguins',
    'WSH': 'Washington Capitals',
    'PHI': 'Philadelphia Flyers',
    'CBJ': 'Columbus Blue Jackets',
    'CAR': 'Carolina Hurricanes',
    'NSH': 'Nashville Predators',
    'WPG': 'Winnipeg Jets',
    'MIN': 'Minnesota Wild',
    'COL': 'Colorado Avalanche',
    'DAL': 'Dallas Stars',
    'CHI': 'Chicago Blackhawks',
    'STL': 'St. Louis Blues',
    'VGK': 'Vegas Golden Knights',
    'EDM': 'Edmonton Oilers',
    'CGY': 'Calgary Flames',
    'VAN': 'Vancouver Canucks',
    'SEA': 'Seattle Kraken',
    'SJS': 'San Jose Sharks',
    'ANA': 'Anaheim Ducks',
    'LAK': 'Los Angeles Kings',
    'ARI': 'Arizona Coyotes',
    'UTA': 'Utah Hockey Club',
    'UTH': 'Utah Hockey Club'
};

// Alternate team name spellings for matching
export const TEAM_NAME_ALIASES = {
    'St Louis Blues': 'St. Louis Blues',
    'St. Louis Blues': 'St. Louis Blues',
    'Montreal Canadiens': 'Montreal Canadiens',
    'Montréal Canadiens': 'Montreal Canadiens'
};

export const TEAM_MASCOTS = {
    'Toronto Maple Leafs': 'Maple Leafs',
    'Boston Bruins': 'Bruins',
    'Tampa Bay Lightning': 'Lightning',
    'Florida Panthers': 'Panthers',
    'Montreal Canadiens': 'Canadiens',
    'Montréal Canadiens': 'Canadiens',
    'Ottawa Senators': 'Senators',
    'Buffalo Sabres': 'Sabres',
    'Detroit Red Wings': 'Red Wings',
    'New York Rangers': 'Rangers',
    'New York Islanders': 'Islanders',
    'New Jersey Devils': 'Devils',
    'Pittsburgh Penguins': 'Penguins',
    'Washington Capitals': 'Capitals',
    'Philadelphia Flyers': 'Flyers',
    'Columbus Blue Jackets': 'Blue Jackets',
    'Carolina Hurricanes': 'Hurricanes',
    'Nashville Predators': 'Predators',
    'Winnipeg Jets': 'Jets',
    'Minnesota Wild': 'Wild',
    'Colorado Avalanche': 'Avalanche',
    'Dallas Stars': 'Stars',
    'Chicago Blackhawks': 'Blackhawks',
    'St. Louis Blues': 'Blues',
    'St Louis Blues': 'Blues',
    'Vegas Golden Knights': 'Golden Knights',
    'Edmonton Oilers': 'Oilers',
    'Calgary Flames': 'Flames',
    'Vancouver Canucks': 'Canucks',
    'Seattle Kraken': 'Kraken',
    'San Jose Sharks': 'Sharks',
    'Anaheim Ducks': 'Ducks',
    'Los Angeles Kings': 'Kings',
    'Arizona Coyotes': 'Coyotes',
    'Utah Hockey Club': 'Hockey Club',
    'Utah Mammoth': 'Mammoth'
};

// Major bookmakers for line prioritization
export const MAJOR_BOOKMAKERS = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'BetRivers'];

// Hit rate thresholds
export const HIT_RATE_THRESHOLDS = {
    EXCELLENT: 70,
    GOOD: 50,
    MEDIUM: 30
};

// Default values
export const DEFAULTS = {
    MIN_GAMES_PLAYER: 5,
    MIN_GAMES_GOALIE: 3,
    DEFAULT_LINE: 0.5
};
