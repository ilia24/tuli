import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request) {
  try {
    const { worldKey, worldData } = await request.json();
    
    // Generate the file content
    const fileContent = `// ${worldData.name} Configuration
export const ${worldKey} = ${JSON.stringify(worldData, null, 2)};
`;
    
    // Write to the world file
    const filePath = join(process.cwd(), 'lib', 'worlds', `${worldKey}.js`);
    await writeFile(filePath, fileContent, 'utf8');
    
    return Response.json({ 
      success: true, 
      message: `World saved to lib/worlds/${worldKey}.js` 
    });
  } catch (error) {
    console.error('Error saving world:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

