pipeline {
    agent any
    stages {
        stage('Install') {
            steps {
                sh 'npm install --no-audit --no-fund'
            }
        }
        stage('Test') {
            steps {
                sh 'npm run test -- --coverage --watchAll=false --passWithNoTests'
            }
        }
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('sonarqube') {
                    sh '''
                        npx sonarqube-scanner \
                        -Dsonar.projectKey=pi_twin5_back \
                        -Dsonar.sources=src \
                        -Dsonar.tests=src \
                        -Dsonar.test.inclusions=**/*.spec.ts \
                        -Dsonar.exclusions=**/*.spec.ts,**/*.module.ts,**/*.entity.ts,**/*.dto.ts,**/entities/**,**/dto/** \
                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                        -Dsonar.coverage.exclusions=**/*.module.ts,**/*.entity.ts,**/*.dto.ts,**/entities/**,**/dto/**
                    '''
                }
            }
        }
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
        stage('Docker Build') {
            steps {
                sh 'docker build -t oussemadn/pre-val-backend:latest .'
            }
        }
        stage('Docker Push') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'USER',
                    passwordVariable: 'PASS'
                )]) {
                    sh 'docker login -u $USER -p $PASS'
                    sh 'docker push oussemadn/pre-val-backend:latest'
                }
            }
        }
        stage('Trigger CD') {
            steps {
                build job: 'backend-cd', wait: false
            }
        }
    }
}
