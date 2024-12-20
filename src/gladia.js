
import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import FormData from 'form-data';

dotenv.config();

export async function transcribeAudioFile(convertedFilePath) {
  const formData = new FormData();
  formData.append('audio', fs.createReadStream(convertedFilePath));

  try {
    const uploadResponse = await fetch('https://api.gladia.io/v2/upload', {
      method: 'POST',
      headers: {
        'x-gladia-key': process.env.GLADIA_API_KEY,
      },
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    console.log('uploadData:', uploadData);
    const uploadUrl = uploadData.audio_url;

    const transcribeResponse = await fetch('https://api.gladia.io/v2/pre-recorded', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gladia-key': process.env.GLADIA_API_KEY,
      },
      body: JSON.stringify({
        audio_url: uploadUrl,
        language: 'ja'
      }),
    });

    const transcribeData = await transcribeResponse.json();
    console.log('transcribeData:', transcribeData);
    const transcriptionId = transcribeData.id;

    const fullTranscript = await pollForTranscriptionResult(transcriptionId);
    return fullTranscript;
  } catch (error) {
    console.error('An error occurred during transcription:', error);
    throw error;
  }
}

async function fetchTranscription(transcriptionId) {
  try {
    const resultResponse = await fetch(`https://api.gladia.io/v2/pre-recorded/${transcriptionId}`, {
      method: 'GET',  
      headers: {
        'x-gladia-key': process.env.GLADIA_API_KEY,
      },
    });

    const resultData = await resultResponse.json();
    console.log('resultData:', resultData);

    if (resultData.status === 'done' && resultData.result && resultData.result.transcription) {
      return resultData.result.transcription.full_transcript;
    } else if (resultData.status === 'queued' || resultData.status === 'processing') {
      console.log('Transcription is still processing...');
      return null;
    } else {
      throw new Error('Unexpected API response');
    }
    
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;  
  }
}

async function pollForTranscriptionResult(transcriptionId, interval = 10000, maxAttempts = 10) {
  try {
    let transcript;
    let attempts = 0;
    do {
      transcript = await fetchTranscription(transcriptionId);
      if (transcript) {
        return transcript;
      }
      console.log('Waiting for transcription result...');
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('Max attempts reached. Transcription may still be processing.');
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    } while (!transcript);
  } catch (error) {
    console.error('An error occurred during transcription polling:', error);
    throw error;
  }
}

      

    
