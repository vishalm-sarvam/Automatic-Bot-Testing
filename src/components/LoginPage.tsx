import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '@/stores/authStore';
import { FlaskConical, Shield, Zap, Globe } from 'lucide-react';
import type { User } from '@/types';

interface GoogleJwtPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
  hd?: string; // Hosted domain for Google Workspace
}

export function LoginPage() {
  const { login, setError, setLoading } = useAuthStore();

  const handleSuccess = (credentialResponse: CredentialResponse) => {
    setLoading(true);

    try {
      if (!credentialResponse.credential) {
        throw new Error('No credential received');
      }

      const decoded = jwtDecode<GoogleJwtPayload>(credentialResponse.credential);

      const user: User = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        accessToken: credentialResponse.credential,
      };

      login(user);
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to process login. Please try again.');
    }
  };

  const handleError = () => {
    setError('Google login failed. Please try again.');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 text-primary-foreground">
            <FlaskConical className="h-10 w-10" />
            <span className="text-2xl font-bold">Bot Tester</span>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-primary-foreground">
            Automated Testing for Conversational AI
          </h1>
          <p className="text-xl text-primary-foreground/80">
            Test your Sarvam Agents with generated scenarios, detect
            translation issues, and improve your bot's quality.
          </p>

          <div className="space-y-4 pt-8">
            <div className="flex items-center gap-4 text-primary-foreground/90">
              <div className="h-10 w-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Automatic Scenario Generation</p>
                <p className="text-sm text-primary-foreground/70">
                  Generate test scenarios from your state graph
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-primary-foreground/90">
              <div className="h-10 w-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Multi-language Support</p>
                <p className="text-sm text-primary-foreground/70">
                  Test in Tamil, Hindi, English, and more
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-primary-foreground/90">
              <div className="h-10 w-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Issue Detection</p>
                <p className="text-sm text-primary-foreground/70">
                  Catch translation and transliteration errors
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-primary-foreground/60">
          Powered by Sarvam AI
        </p>
      </div>

      {/* Right side - Login */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3">
            <FlaskConical className="h-10 w-10 text-primary" />
            <span className="text-2xl font-bold">Bot Tester</span>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold">Welcome back</h2>
            <p className="text-muted-foreground mt-2">
              Sign in with your Google Workspace account
            </p>
          </div>

          <div className="card p-8">
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                useOneTap
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
                logo_alignment="left"
              />
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Secure authentication
                </span>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              By signing in, you agree to our terms of service and privacy
              policy. Only @sarvam.ai accounts are allowed.
            </p>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Having trouble? Contact{' '}
            <a href="mailto:support@sarvam.ai" className="text-primary hover:underline">
              support@sarvam.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
