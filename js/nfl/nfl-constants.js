// js/nfl/nfl-constants.js - NFL-specific constants

export const NFL_TEAMS = {
    'ARI': 'Arizona Cardinals',
    'ATL': 'Atlanta Falcons',
    'BAL': 'Baltimore Ravens',
    'BUF': 'Buffalo Bills',
    'CAR': 'Carolina Panthers',
    'CHI': 'Chicago Bears',
    'CIN': 'Cincinnati Bengals',
    'CLE': 'Cleveland Browns',
    'DAL': 'Dallas Cowboys',
    'DEN': 'Denver Broncos',
    'DET': 'Detroit Lions',
    'GB': 'Green Bay Packers',
    'HOU': 'Houston Texans',
    'IND': 'Indianapolis Colts',
    'JAX': 'Jacksonville Jaguars',
    'KC': 'Kansas City Chiefs',
    'LAC': 'Los Angeles Chargers',
    'LAR': 'Los Angeles Rams',
    'LV': 'Las Vegas Raiders',
    'MIA': 'Miami Dolphins',
    'MIN': 'Minnesota Vikings',
    'NE': 'New England Patriots',
    'NO': 'New Orleans Saints',
    'NYG': 'New York Giants',
    'NYJ': 'New York Jets',
    'PHI': 'Philadelphia Eagles',
    'PIT': 'Pittsburgh Steelers',
    'SEA': 'Seattle Seahawks',
    'SF': 'San Francisco 49ers',
    'TB': 'Tampa Bay Buccaneers',
    'TEN': 'Tennessee Titans',
    'WAS': 'Washington Commanders'
};

// Mapping for different name formats from APIs
export const NFL_TEAM_ALIASES = {
    'Arizona Cardinals': 'ARI',
    'Atlanta Falcons': 'ATL',
    'Baltimore Ravens': 'BAL',
    'Buffalo Bills': 'BUF',
    'Carolina Panthers': 'CAR',
    'Chicago Bears': 'CHI',
    'Cincinnati Bengals': 'CIN',
    'Cleveland Browns': 'CLE',
    'Dallas Cowboys': 'DAL',
    'Denver Broncos': 'DEN',
    'Detroit Lions': 'DET',
    'Green Bay Packers': 'GB',
    'Houston Texans': 'HOU',
    'Indianapolis Colts': 'IND',
    'Jacksonville Jaguars': 'JAX',
    'Kansas City Chiefs': 'KC',
    'Los Angeles Chargers': 'LAC',
    'LA Chargers': 'LAC',
    'Los Angeles Rams': 'LAR',
    'LA Rams': 'LAR',
    'Las Vegas Raiders': 'LV',
    'Miami Dolphins': 'MIA',
    'Minnesota Vikings': 'MIN',
    'New England Patriots': 'NE',
    'New Orleans Saints': 'NO',
    'New York Giants': 'NYG',
    'NY Giants': 'NYG',
    'New York Jets': 'NYJ',
    'NY Jets': 'NYJ',
    'Philadelphia Eagles': 'PHI',
    'Pittsburgh Steelers': 'PIT',
    'Seattle Seahawks': 'SEA',
    'San Francisco 49ers': 'SF',
    'San Francisco': 'SF',
    'Tampa Bay Buccaneers': 'TB',
    'Tennessee Titans': 'TEN',
    'Washington Commanders': 'WAS',
    'Washington': 'WAS'
};

export const NFL_POSITIONS = {
    QB: ['QB'],
    RB: ['RB', 'FB'],
    WR: ['WR'],
    TE: ['TE'],
    FLEX: ['RB', 'WR', 'TE']
};

export const NFL_PROP_TYPES = {
    passing_yards: {
        label: 'Passing Yards',
        positions: ['QB'],
        oddsMarket: 'player_pass_yds',
        statKey: 'passingYards',
        stats: [
            { key: 'passingYards', label: 'Yds/G', perGame: true },
            { key: 'passingTouchdowns', label: 'TD/G', perGame: true },
            { key: 'completionPct', label: 'Cmp%', perGame: false }
        ]
    },
    passing_tds: {
        label: 'Passing TDs',
        positions: ['QB'],
        oddsMarket: 'player_pass_tds',
        statKey: 'passingTouchdowns',
        stats: [
            { key: 'passingTouchdowns', label: 'TD/G', perGame: true },
            { key: 'passingYards', label: 'Yds/G', perGame: true },
            { key: 'interceptions', label: 'INT/G', perGame: true }
        ]
    },
    rushing_yards: {
        label: 'Rushing Yards',
        positions: ['RB', 'QB'],
        oddsMarket: 'player_rush_yds',
        statKey: 'rushingYards',
        stats: [
            { key: 'rushingYards', label: 'Yds/G', perGame: true },
            { key: 'rushingTouchdowns', label: 'TD/G', perGame: true },
            { key: 'yardsPerCarry', label: 'YPC', perGame: false }
        ]
    },
    receiving_yards: {
        label: 'Receiving Yards',
        positions: ['WR', 'TE', 'RB'],
        oddsMarket: 'player_reception_yds',
        statKey: 'receivingYards',
        stats: [
            { key: 'receivingYards', label: 'Yds/G', perGame: true },
            { key: 'receptions', label: 'Rec/G', perGame: true },
            { key: 'receivingTouchdowns', label: 'TD/G', perGame: true }
        ]
    },
    receptions: {
        label: 'Receptions',
        positions: ['WR', 'TE', 'RB'],
        oddsMarket: 'player_receptions',
        statKey: 'receptions',
        stats: [
            { key: 'receptions', label: 'Rec/G', perGame: true },
            { key: 'receivingYards', label: 'Yds/G', perGame: true },
            { key: 'targets', label: 'Tgt/G', perGame: true }
        ]
    },
    anytime_td: {
        label: 'Anytime TD',
        positions: ['RB', 'WR', 'TE', 'QB'],
        oddsMarket: 'player_anytime_td',
        statKey: 'totalTouchdowns',
        isAnytime: true,
        stats: [
            { key: 'rushingTouchdowns', label: 'RuTD/G', perGame: true },
            { key: 'receivingTouchdowns', label: 'RecTD/G', perGame: true },
            { key: 'totalTouchdowns', label: 'TD/G', perGame: true }
        ]
    }
};

export const NFL_HIT_RATE_GAMES = 5;

export const NFL_ODDS_MARKETS = [
    'player_pass_yds',
    'player_pass_tds',
    'player_rush_yds',
    'player_reception_yds',
    'player_receptions',
    'player_anytime_td'
];

// ESPN stat IDs
export const ESPN_STAT_IDS = {
    passingYards: 3,
    passingTouchdowns: 4,
    passingAttempts: 0,
    completions: 1,
    interceptions: 20,
    rushingYards: 23,
    rushingTouchdowns: 25,
    rushingAttempts: 24,
    receivingYards: 42,
    receptions: 53,
    receivingTouchdowns: 43,
    targets: 58
};
