const fs = require('fs');
const path = require('path');

describe('Project Structure Validation', () => {
    const rootDir = path.resolve(__dirname, '..');

    const requiredDirs = [
        'services/api-gateway',
        'services/assignment-service',
        'services/creator-service',
        'services/matching-service',
        'shared/models',
        'shared/services',
        'shared/validation',
        'frontend/src'
    ];

    const requiredFiles = [
        'docker-compose.yml',
        '.env',
        'package.json',
        'README.md'
    ];

    test('Property: All core service directories exist', () => {
        requiredDirs.forEach(dir => {
            const fullPath = path.join(rootDir, dir);
            expect(fs.existsSync(fullPath)).toBe(true);
            expect(fs.lstatSync(fullPath).isDirectory()).toBe(true);
        });
    });

    test('Property: Essential configuration files exist', () => {
        requiredFiles.forEach(file => {
            const fullPath = path.join(rootDir, file);
            expect(fs.existsSync(fullPath)).toBe(true);
            expect(fs.lstatSync(fullPath).isFile()).toBe(true);
        });
    });

    test('Property: Each service has a Dockerfile', () => {
        const services = [
            'api-gateway',
            'assignment-service',
            'creator-service',
            'matching-service'
        ];

        services.forEach(service => {
            const dockerPath = path.join(rootDir, 'services', service, 'Dockerfile');
            expect(fs.existsSync(dockerPath)).toBe(true);
        });
    });
});
