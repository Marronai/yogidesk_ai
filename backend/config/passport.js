const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback",
        proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('🔍 Google Profile:', profile.emails[0].value); // ✅ Debug log

            const newUser = {
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                avatar: profile.photos[0].value,
                isVerified: true // ✅ Google users are pre-verified
            }

            // Check if user already exists by email
            let user = await User.findOne({ email: profile.emails[0].value });
            
            if (user) {
                // ✅ Agar user pehle se hai but googleId nahi hai, toh add karo
                if (!user.googleId) {
                    user.googleId = profile.id;
                    user.avatar = profile.photos[0].value;
                    user.isVerified = true;
                    await user.save();
                }
                console.log('✅ Existing user logged in:', user.email);
                return done(null, user);
            } else {
                // ✅ Naya user create karo
                user = await User.create(newUser);
                console.log('✅ New user created:', user.email);
                return done(null, user);
            }
        } catch (err) {
            console.error('❌ Passport Google Strategy Error:', err);
            return done(err, null); // ✅ Error properly handle karo
        }
    }));

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // ✅ FIXED: Async/await pattern use karo
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            console.error('❌ Deserialize error:', err);
            done(err, null);
        }
    });
};