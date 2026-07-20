<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Illuminate\Support\Str;

class GoogleAuthController
{
    /**
     * Redirect the user to the Google authentication page.
     */
    public function redirect()
    {
        return Socialite::driver('google')->stateless()->redirect();
    }

    /**
     * Obtain the user information from Google.
     */
    public function callback()
    {
        try {
            $googleUser = Socialite::driver('google')->stateless()->user();

            $user = User::where('google_id', $googleUser->id)->orWhere('email', $googleUser->email)->first();

            if (!$user) {
                // Register new user as 'warga'
                $user = User::create([
                    'id' => (string) Str::uuid(),
                    'name' => $googleUser->name,
                    'email' => $googleUser->email,
                    'google_id' => $googleUser->id,
                    'role' => 'warga',
                    'status' => 'aktif', // Auto-approve Google signups
                ]);
            } else {
                // Update existing user with google_id if not present
                if (!$user->google_id) {
                    $user->update(['google_id' => $googleUser->id]);
                }
            }

            // Create Sanctum token
            $token = $user->createToken('auth_token')->plainTextToken;
            $user->update(['last_login_at' => now()]);

            // Pass the token to the frontend (which is likely hosted on a different port or same domain).
            // We redirect back to the frontend's OAuth callback page with the token.
            $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');
            return redirect($frontendUrl . '/oauth-callback?token=' . $token);

        } catch (\Exception $e) {
            \Log::error('Google Auth Error: ' . $e->getMessage());
            $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');
            return redirect($frontendUrl . '/login?error=google_auth_failed');
        }
    }
}
