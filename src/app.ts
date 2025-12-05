import { join } from 'path'
import pino from 'pino'
import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { SherpaProvider as Provider } from '@builderbot/provider-sherpa'
import flows from './flujos'
const PORT = process.env.PORT ?? 3008

const main = async () => {
  
    
    const adapterProvider = createProvider(Provider, 
		{ version: [2, 3000, 1027934701] as any } 
	)
    const adapterDB = new Database()

    const { httpServer } = await createBot({
        flow: flows,
        provider: adapterProvider,
        database: adapterDB,
    })


    httpServer(+PORT)
}

main().catch((error) => {
  console.error('❌ Error no capturado:', error)
  process.exit(1)
})