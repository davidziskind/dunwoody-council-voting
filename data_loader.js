/**
 * Data Loader Utility for Dunwoody Voting Tracker
 * This utility handles loading configuration and meeting data from separate files
 */

class DataLoader {
    constructor() {
        this.config = null;
        this.cache = new Map();
    }

    /**
     * Load the main configuration file
     */
    async loadConfig(configPath = 'config.json') {
        try {
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.statusText}`);
            }
            this.config = await response.json();
            return this.config;
        } catch (error) {
            console.error('Error loading configuration:', error);
            throw error;
        }
    }

    /**
     * Load a single meeting file with caching
     */
    async loadMeetingFile(filePath) {
        // Check cache first
        if (this.cache.has(filePath)) {
            return this.cache.get(filePath);
        }

        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load meeting file ${filePath}: ${response.statusText}`);
            }
            
            const meetingData = await response.json();
            
            // Validate meeting data structure
            this.validateMeetingData(meetingData, filePath);
            
            // Cache the result
            this.cache.set(filePath, meetingData);
            
            return meetingData;
        } catch (error) {
            console.error(`Error loading meeting file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Load all meeting files based on configuration
     */
    async loadAllMeetings() {
        if (!this.config) {
            throw new Error('Configuration must be loaded first');
        }

        const loadingPromises = this.config.meetingFiles.map(file => 
            this.loadMeetingFile(file).catch(error => {
                console.warn(`Failed to load ${file}:`, error);
                return null; // Return null for failed loads
            })
        );

        const results = await Promise.all(loadingPromises);
        
        // Filter out failed loads and sort by date
        const meetings = results
            .filter(meeting => meeting !== null)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        return meetings;
    }

    /**
     * Validate meeting data structure
     */
    validateMeetingData(data, filePath) {
        const requiredFields = ['date', 'status', 'attendance', 'motions'];
        
        for (const field of requiredFields) {
            if (!(field in data)) {
                throw new Error(`Missing required field '${field}' in ${filePath}`);
            }
        }

        // Validate status
        if (!['completed', 'upcoming', 'cancelled'].includes(data.status)) {
            console.warn(`Unexpected status '${data.status}' in ${filePath}`);
        }

        // Validate motions structure for completed meetings
        if (data.status === 'completed' && data.motions.length > 0) {
            data.motions.forEach((motion, index) => {
                const requiredMotionFields = ['title', 'description', 'votes', 'result'];
                for (const field of requiredMotionFields) {
                    if (!(field in motion)) {
                        throw new Error(`Motion ${index} missing field '${field}' in ${filePath}`);
                    }
                }
                
                // Validate vote count matches council member count
                if (this.config && motion.votes.length !== this.config.councilMembers.length) {
                    console.warn(`Vote count mismatch for motion "${motion.title}" in ${filePath}`);
                }
            });
        }
    }

    /**
     * Get cached meeting data
     */
    getCachedMeeting(filePath) {
        return this.cache.get(filePath);
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get configuration
     */
    getConfig() {
        return this.config;
    }

    /**
     * Preload critical data
     */
    async preload() {
        try {
            await this.loadConfig();
            const meetings = await this.loadAllMeetings();
            console.log(`Preloaded ${meetings.length} meetings`);
            return { config: this.config, meetings };
        } catch (error) {
            console.error('Preload failed:', error);
            throw error;
        }
    }
}

// Usage example:
/*
const dataLoader = new DataLoader();

// Option 1: Preload everything
dataLoader.preload()
    .then(({ config, meetings }) => {
        console.log('Data loaded:', config, meetings);
        // Initialize your app here
    })
    .catch(error => {
        console.error('Failed to load data:', error);
    });

// Option 2: Load step by step
async function initApp() {
    try {
        const config = await dataLoader.loadConfig();
        const meetings = await dataLoader.loadAllMeetings();
        
        // Initialize app with loaded data
        new DunwoodyVotingTracker(config, meetings);
    } catch (error) {
        console.error('App initialization failed:', error);
    }
}
*/

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataLoader;
}